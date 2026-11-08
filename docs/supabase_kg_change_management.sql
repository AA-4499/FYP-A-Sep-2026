-- Controlled Clinical Knowledge Graph change management (Phase 2)
-- Apply manually in the Supabase SQL Editor for the project used by KnowledgeGraph.
-- This stores proposals, reviews and role grants only. It DOES NOT write to Neo4j Aura.

create extension if not exists pgcrypto;

create table if not exists public.kg_user_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('kg_reviewer', 'kg_curator')),
  granted_by uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create table if not exists public.kg_change_proposals (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id),
  target_type text not null check (target_type in ('concept', 'relationship', 'source')),
  operation text not null check (operation in ('create', 'update', 'retire')),
  target_key text not null check (length(trim(target_key)) between 1 and 240),
  proposed_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_payload) = 'object'),
  change_reason text not null check (length(trim(change_reason)) > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'changes_requested', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint kg_retire_has_no_payload check (operation <> 'retire' or proposed_payload = '{}'::jsonb)
);

create index if not exists kg_change_proposals_submitted_by_created_idx on public.kg_change_proposals (submitted_by, created_at desc);
create index if not exists kg_change_proposals_status_created_idx on public.kg_change_proposals (status, created_at desc);

create table if not exists public.kg_change_events (
  id bigint generated always as identity primary key,
  proposal_id uuid references public.kg_change_proposals(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists kg_change_events_proposal_created_idx on public.kg_change_events (proposal_id, created_at desc);

alter table public.kg_user_permissions enable row level security;
alter table public.kg_change_proposals enable row level security;
alter table public.kg_change_events enable row level security;

revoke all on public.kg_user_permissions from public, anon, authenticated;
revoke all on public.kg_change_proposals from public, anon, authenticated;
revoke all on public.kg_change_events from public, anon, authenticated;
-- The API reads these tables; all writes are performed only by the narrow SECURITY DEFINER RPC functions below.
grant select on public.kg_user_permissions to service_role;
grant select on public.kg_change_proposals to service_role;
grant select on public.kg_change_events to service_role;

create or replace function public.kg_submit_change_proposal(
  p_submitted_by uuid, p_target_type text, p_operation text, p_target_key text,
  p_proposed_payload jsonb, p_change_reason text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare proposal public.kg_change_proposals;
begin
  if p_target_type not in ('concept', 'relationship', 'source')
    or p_operation not in ('create', 'update', 'retire')
    or length(trim(coalesce(p_target_key, ''))) not between 1 and 240
    or length(trim(coalesce(p_change_reason, ''))) = 0
    or jsonb_typeof(coalesce(p_proposed_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid proposal payload';
  end if;
  if p_operation = 'retire' and coalesce(p_proposed_payload, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'Retirement proposals cannot include replacement data';
  end if;
  insert into public.kg_change_proposals
    (submitted_by, target_type, operation, target_key, proposed_payload, change_reason)
  values (p_submitted_by, p_target_type, p_operation, trim(p_target_key),
    coalesce(p_proposed_payload, '{}'::jsonb), trim(p_change_reason))
  returning * into proposal;
  insert into public.kg_change_events (proposal_id, actor_id, action, detail)
  values (proposal.id, p_submitted_by, 'submitted', jsonb_build_object('status', proposal.status));
  return to_jsonb(proposal);
end;
$$;

create or replace function public.kg_review_change_proposal(
  p_reviewer_id uuid, p_proposal_id uuid, p_decision text, p_review_note text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare proposal public.kg_change_proposals; previous_status text;
begin
  if not exists (select 1 from public.kg_user_permissions
    where user_id = p_reviewer_id and permission = 'kg_reviewer') then
    raise exception 'KG reviewer permission required';
  end if;
  if p_decision not in ('under_review', 'approved', 'rejected', 'changes_requested')
    or length(trim(coalesce(p_review_note, ''))) = 0 then
    raise exception 'A valid review decision and note are required';
  end if;
  select * into proposal from public.kg_change_proposals where id = p_proposal_id for update;
  if not found then raise exception 'Proposal not found'; end if;
  if proposal.submitted_by = p_reviewer_id then raise exception 'The proposer cannot review their own change'; end if;
  if proposal.status not in ('submitted', 'under_review', 'changes_requested') then
    raise exception 'This proposal has already received a final decision';
  end if;
  previous_status := proposal.status;
  update public.kg_change_proposals
  set status = p_decision, reviewed_by = p_reviewer_id, review_note = trim(p_review_note),
      updated_at = now(),
      decided_at = case when p_decision in ('approved', 'rejected') then now() else null end
  where id = p_proposal_id returning * into proposal;
  insert into public.kg_change_events (proposal_id, actor_id, action, detail)
  values (proposal.id, p_reviewer_id, 'review_' || p_decision,
    jsonb_build_object('from', previous_status, 'to', p_decision, 'note', trim(p_review_note)));
  return to_jsonb(proposal);
end;
$$;

create or replace function public.kg_manage_user_permission(
  p_admin_id uuid, p_user_id uuid, p_permission text, p_enabled boolean, p_reason text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare affected integer := 0;
begin
  if p_permission not in ('kg_reviewer', 'kg_curator')
    or length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A valid permission and reason are required';
  end if;
  if p_enabled then
    insert into public.kg_user_permissions (user_id, permission, granted_by, reason)
    values (p_user_id, p_permission, p_admin_id, trim(p_reason))
    on conflict (user_id, permission)
    do update set granted_by = excluded.granted_by, reason = excluded.reason, created_at = now();
    affected := 1;
  else
    delete from public.kg_user_permissions where user_id = p_user_id and permission = p_permission;
    get diagnostics affected = row_count;
  end if;
  insert into public.kg_change_events (proposal_id, actor_id, action, detail)
  values (null, p_admin_id,
    case when p_enabled then 'permission_granted' else 'permission_revoked' end,
    jsonb_build_object('user_id', p_user_id, 'permission', p_permission, 'reason', trim(p_reason)));
  return jsonb_build_object('success', true, 'affected', affected, 'enabled', p_enabled);
end;
$$;

revoke all on function public.kg_submit_change_proposal(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.kg_review_change_proposal(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.kg_manage_user_permission(uuid, uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.kg_submit_change_proposal(uuid, text, text, text, jsonb, text) to service_role;
grant execute on function public.kg_review_change_proposal(uuid, uuid, text, text) to service_role;
grant execute on function public.kg_manage_user_permission(uuid, uuid, text, boolean, text) to service_role;

-- No statement in this migration seeds, updates, retires or deletes Aura graph records.
