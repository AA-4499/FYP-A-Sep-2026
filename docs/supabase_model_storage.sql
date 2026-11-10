-- Run once in the Supabase SQL Editor. No clinical table or KG policy is changed.
begin;
create table if not exists public.model_runtime_state (
  model_id text primary key,
  active jsonb,
  job jsonb not null default '{"status":"idle"}'::jsonb,
  lease_id uuid,
  lease_until timestamptz
);
alter table public.model_runtime_state enable row level security;
revoke all on public.model_runtime_state from public, anon, authenticated;
grant select, insert, update on public.model_runtime_state to service_role;

create or replace function public.model_storage_control(
  p_action text, p_model_id text default 'legacy-gru', p_run_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  state public.model_runtime_state%rowtype;
begin
  if p_model_id <> 'legacy-gru' then raise exception 'Unsupported model identifier'; end if;
  insert into public.model_runtime_state(model_id) values (p_model_id) on conflict do nothing;
  select * into strict state from public.model_runtime_state where model_id = p_model_id for update;
  if p_action = 'recover' then
    if (state.lease_until is null or state.lease_until <= clock_timestamp()) and state.job->>'status' = 'running' then
      update public.model_runtime_state set job = state.job || jsonb_build_object(
        'status','failed','finished_at',clock_timestamp(),
        'error','The training worker stopped or its lease expired. The active model and baseline remain unchanged.'),
        lease_id = null, lease_until = null where model_id = p_model_id;
    end if;
  elsif p_action = 'acquire' then
    if p_run_id is null or p_payload->>'run_id' is distinct from p_run_id::text then
      raise exception 'Invalid training run';
    end if;
    if state.lease_until > clock_timestamp() then raise exception 'A training job is already running'; end if;
    if state.active->'baseline_object' is not null and state.active->>'baseline_object' is not null
       and (state.active->>'activated_at')::timestamptz + interval '7 days' > clock_timestamp() then
      raise exception 'The minimum 7-day training interval has not elapsed';
    end if;
    update public.model_runtime_state set lease_id=p_run_id, lease_until=clock_timestamp()+interval '15 minutes',
      job=p_payload where model_id=p_model_id;
  elsif p_action in ('renew','activate','job') then
    if p_run_id is null or state.lease_id is distinct from p_run_id or state.lease_until is null or state.lease_until <= clock_timestamp() then
      raise exception 'The training lease was lost or expired';
    end if;
    if p_action='renew' then
      update public.model_runtime_state set lease_until=clock_timestamp()+interval '15 minutes' where model_id=p_model_id;
    elsif p_action='activate' then
      if p_payload->>'run_id' is distinct from p_run_id::text or coalesce(p_payload->>'model_sha256','') !~ '^[a-f0-9]{64}$'
         or coalesce(p_payload->'comparison'->>'accepted', 'false') <> 'true' then
        raise exception 'Invalid or unapproved model activation';
      end if;
      update public.model_runtime_state set active=p_payload,
        job=state.job || jsonb_build_object('status','completed','finished_at',p_payload->>'activated_at',
           'model_sha256',p_payload->>'model_sha256','comparison',p_payload->'comparison')
        where model_id=p_model_id;
    else
      if p_payload->>'run_id' is distinct from p_run_id::text then raise exception 'Invalid job identity'; end if;
      update public.model_runtime_state set job=p_payload where model_id=p_model_id;
    end if;
  elsif p_action='release' then
    -- A stale process must never release a newer worker's lease.
    update public.model_runtime_state set lease_id=null,lease_until=null
      where model_id=p_model_id and lease_id=p_run_id;
  elsif p_action <> 'read' then raise exception 'Unsupported model storage action';
  end if;
  select * into strict state from public.model_runtime_state where model_id=p_model_id;
  return jsonb_build_object('active',state.active,'job',state.job,'lease_id',state.lease_id,
                           'lease_until',state.lease_until,'server_time',clock_timestamp());
end;
$$;
revoke all on function public.model_storage_control(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.model_storage_control(text,text,uuid,jsonb) to service_role;
commit;
