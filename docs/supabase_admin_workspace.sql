-- Admin workspace production migration.
-- Apply in the Supabase SQL Editor AFTER, in this order:
--   supabase_phase2.sql
--   supabase_patient_registration.sql
--   supabase_patient_auto_provision.sql
--   supabase_patient_dashboard.sql
--
-- The script is transactional and safe to rerun. It never deletes clinical or
-- account data: duplicate legacy patient assignments abort the transaction with
-- an actionable message instead of being silently rewritten.
--
-- Security model:
--   * Every function below is SECURITY DEFINER with an empty search_path and
--     fully schema-qualified references.
--   * Client-facing helpers/RPCs are revoked from PUBLIC and anon and granted
--     only to authenticated; each admin RPC re-checks public.is_active_admin().
--   * admin_audit_logs and doctor_applications have RLS enabled with no client
--     policies and no client grants, so they are reachable only through the
--     SECURITY DEFINER RPCs.
--   * profiles.role may be the public.app_role enum or text. Comparisons are
--     written as role::text = '...' and writes assign string literals so both
--     layouts work.
begin;

-- ---------------------------------------------------------------------------
-- Schema: account status, profile department, applications, audit trail
-- ---------------------------------------------------------------------------

-- Guarded enum creation (safe on fresh installs, reruns, and text-based schemas).
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'account_status'
  ) then
    create type public.account_status as enum ('active', 'suspended');
  end if;
end;
$$;

alter table public.profiles add column if not exists status public.account_status not null default 'active';
alter table public.profiles add column if not exists department text;

create table if not exists public.doctor_applications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  registration_id text,
  organisation text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists doctor_applications_status_created_idx
  on public.doctor_applications (status, created_at);

-- RPC-only table: no client policies and no client grants.
alter table public.doctor_applications enable row level security;
revoke all on table public.doctor_applications from public, anon, authenticated;

create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_email text,
  action text not null,
  subject_user_id uuid,
  subject_label text,
  patient_id text,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action);

-- RPC-only table: RLS with no policies plus explicit revokes.
alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from public, anon, authenticated;

-- The assignments table may predate this migration. Creating it when missing
-- keeps phase2's definition (one clinician per patient pair, many per clinician).
create table if not exists public.clinician_patient_assignments (
  clinician_id uuid not null references public.profiles(id) on delete cascade,
  patient_id text not null,
  created_at timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);
alter table public.clinician_patient_assignments enable row level security;

-- One active care-team doctor per patient. Abort rather than delete anything.
do $$
declare
  duplicate_patients int;
  duplicate_list text;
begin
  select count(*)::int into duplicate_patients
  from (
    select patient_id
    from public.clinician_patient_assignments
    group by patient_id
    having count(*) > 1
  ) duplicates;

  if duplicate_patients > 0 then
    select string_agg(format('%s (%s assignments)', patient_id, assignment_count), '; '
                      order by patient_id)
      into duplicate_list
    from (
      select patient_id, count(*)::int as assignment_count
      from public.clinician_patient_assignments
      group by patient_id
      having count(*) > 1
      order by patient_id
      limit 25
    ) duplicates;

    raise exception
      'One doctor per patient cannot be enforced: % patient(s) have duplicate assignments: %. Reassign the duplicates manually, then rerun this migration.',
      duplicate_patients, duplicate_list;
  end if;
end;
$$;

create unique index if not exists clinician_patient_assignments_patient_unique
  on public.clinician_patient_assignments (patient_id);

-- ---------------------------------------------------------------------------
-- Auth trigger: profile provisioning plus doctor application capture
-- ---------------------------------------------------------------------------

-- Registration keeps every account as Patient; requested_role=doctor additionally
-- records a pending application for admin review. Requested roles never grant access.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, nric_passport_no)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), 'patient',
    nullif(btrim(new.raw_user_meta_data->>'nric_passport_no'), ''))
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data->>'requested_role', '') = 'doctor' then
    insert into public.doctor_applications (user_id, registration_id, organisation)
    values (
      new.id,
      nullif(btrim(new.raw_user_meta_data->>'registration_id'), ''),
      nullif(btrim(new.raw_user_meta_data->>'organisation'), '')
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Replicated from supabase_patient_auto_provision.sql with one addition: doctor
-- applicants must not receive a Patient record while their application is pending.
create or replace function public.provision_patient_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sequence_value text;
  generated_number text;
  empty_columns text;
  empty_values text;
  account_role text;
  requested_role text;
begin
  -- Doctor applicants are under review; their account stays unlinked to a record.
  select coalesce(raw_user_meta_data->>'requested_role', '') into requested_role
    from auth.users where id = new.id;
  if requested_role = 'doctor' then return new; end if;

  if new.role::text <> 'patient' or new.patient_id is not null then return new; end if;
  -- BEFORE INSERT fires even for ON CONFLICT DO NOTHING. Avoid orphan rows on reruns.
  if tg_op = 'INSERT' and exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  select coalesce(raw_app_meta_data->>'role', 'patient') into account_role
    from auth.users where id = new.id;
  -- Existing/invited Doctor and Admin accounts do not receive Patient records.
  if account_role is distinct from 'patient' then return new; end if;

  -- Explicit NULLs prevent clinical defaults (e.g. default glucose values) from
  -- appearing as measurements. Only system-generated fields retain defaults.
  select string_agg(format(', %I', column_name), '' order by ordinal_position),
         string_agg(', NULL', '' order by ordinal_position)
    into empty_columns, empty_values
    from information_schema.columns
    where table_schema = 'public' and table_name = 'patient_summary'
      and column_name <> 'Patient Number'
      and is_identity = 'NO' and is_generated = 'NEVER'
      and not (column_name in ('id', 'created_at', 'updated_at') and column_default is not null);
  loop
    sequence_value := nextval('public.patient_number_seq'::regclass)::text;
    generated_number := 'PT-' || lpad(sequence_value, greatest(6, length(sequence_value)), '0');
    -- Skip a pre-existing number instead of attaching somebody else's medical record.
    execute format('insert into public.patient_summary ("Patient Number"%s)
      values ($1%s) on conflict ("Patient Number") do nothing returning "Patient Number"',
      coalesce(empty_columns, ''), coalesce(empty_values, ''))
      into new.patient_id using generated_number;
    exit when new.patient_id is not null;
  end loop;
  return new;
end;
$$;
revoke all on function public.provision_patient_record() from public, anon, authenticated;

drop trigger if exists provision_patient_record_on_profile on public.profiles;
create trigger provision_patient_record_on_profile
  before insert or update of role, patient_id on public.profiles
  for each row execute function public.provision_patient_record();

-- Backfill applications for accounts created before this migration.
insert into public.doctor_applications (user_id, registration_id, organisation)
select
  u.id,
  nullif(btrim(u.raw_user_meta_data->>'registration_id'), ''),
  nullif(btrim(u.raw_user_meta_data->>'organisation'), '')
from auth.users u
join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'requested_role' = 'doctor'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'admin' and p.status::text = 'active'
  );
$$;
revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

create or replace function public.current_account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.status::text = 'active' from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.current_account_active() from public;
-- The restrictive clinical read boundary also applies to anon, so anon must be
-- able to evaluate this self-only check (it returns false without a session).
grant execute on function public.current_account_active() to anon, authenticated;

-- RLS primitives. These are SECURITY DEFINER and deliberately opaque (the planner
-- cannot inline security-definer SQL functions), so the clinical read policies do
-- not expose profiles/assignments ACLs to anon and cannot be rewritten into
-- semi-joins that bypass the auth gate.
create or replace function public.current_patient_number()
returns text language sql stable security definer set search_path = '' as $$
  select p.patient_id from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.current_patient_number() from public;
grant execute on function public.current_patient_number() to anon, authenticated;

create or replace function public.is_assigned_to_patient(p_patient_number text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinician_patient_assignments a
    where a.clinician_id = auth.uid() and a.patient_id = p_patient_number
  );
$$;
revoke all on function public.is_assigned_to_patient(text) from public;
grant execute on function public.is_assigned_to_patient(text) to anon, authenticated;

create or replace function public.get_my_access_state()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'role', p.role::text,
    'full_name', coalesce(p.full_name, ''),
    'status', p.status::text,
    'application', (
      select jsonb_build_object('status', a.status, 'review_note', a.review_note)
      from public.doctor_applications a
      where a.user_id = p.id
      order by a.created_at desc
      limit 1
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;
revoke all on function public.get_my_access_state() from public, anon;
grant execute on function public.get_my_access_state() to authenticated;

-- Shared serializer for one account row. Not client-executable: it is only
-- called from SECURITY DEFINER admin RPCs so emails and auth metadata stay private.
create or replace function public.admin_account_json(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'email', u.email,
    'full_name', coalesce(p.full_name, ''),
    'role', p.role::text,
    'status', p.status::text,
    'department', p.department,
    'registration_id', coalesce(
      (
        select a.registration_id from public.doctor_applications a
        where a.user_id = p.id and a.status = 'approved'
        order by a.reviewed_at desc nulls last, a.created_at desc
        limit 1
      ),
      (
        select a.registration_id from public.doctor_applications a
        where a.user_id = p.id
        order by a.created_at desc
        limit 1
      )
    ),
    'joined_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed', (u.email_confirmed_at is not null),
    'patient_id', p.patient_id,
    'doctor_application_status', (
      select a.status from public.doctor_applications a
      where a.user_id = p.id
      order by a.created_at desc
      limit 1
    ),
    'assignment_count', (
      select count(*)::int from public.clinician_patient_assignments a
      where a.clinician_id = p.id
    )
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id;
$$;
revoke all on function public.admin_account_json(uuid) from public, anon, authenticated;

create or replace function public.admin_activity_category(p_action text)
returns text language sql immutable security definer set search_path = '' as $$
  select case
    when p_action ilike '%assign%' then 'assignments'
    when p_action ilike '%application%' or p_action ilike '%approv%'
      or p_action ilike '%reject%' or p_action ilike '%declin%' then 'approvals'
    else 'accounts'
  end;
$$;
revoke all on function public.admin_activity_category(text) from public, anon, authenticated;

-- Internal audit writer: the single place that records actor identity. RPCs call
-- this in the same transaction, satisfying the audit requirement without exposing
-- an insert path to clients.
create or replace function public.record_admin_activity(
  p_action text,
  p_subject_user_id uuid default null,
  p_subject_label text default null,
  p_patient_id text default null,
  p_detail text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_audit_logs (
    actor_id, actor_email, action, subject_user_id, subject_label, patient_id, detail
  ) values (
    auth.uid(),
    (select u.email from auth.users u where u.id = auth.uid()),
    p_action,
    p_subject_user_id,
    p_subject_label,
    p_patient_id,
    coalesce(p_detail, '')
  );
end;
$$;
revoke all on function public.record_admin_activity(text, uuid, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'accounts', (select count(*)::int from public.profiles),
    'activeDoctors', (
      select count(*)::int from public.profiles p
      where p.role::text = 'doctor' and p.status::text = 'active'
    ),
    'patients', (select count(*)::int from public.profiles p where p.role::text = 'patient'),
    'pendingApplications', (
      select count(*)::int from public.doctor_applications a where a.status = 'pending'
    ),
    'unassignedPatients', (
      select count(*)::int from public.profiles p
      where p.role::text = 'patient'
        and p.patient_id is not null
        and not exists (
          select 1 from public.clinician_patient_assignments a where a.patient_id = p.patient_id
        )
    ),
    'suspendedAccounts', (
      select count(*)::int from public.profiles p where p.status::text = 'suspended'
    ),
    'recentActivity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'category', public.admin_activity_category(r.action),
        'action', r.action,
        'actor_email', r.actor_email,
        'subject_label', r.subject_label,
        'detail', r.detail,
        'created_at', r.created_at
      ) order by r.created_at desc, r.id desc)
      from (
        select l.id, l.action, l.actor_email, l.subject_label, l.detail, l.created_at
        from public.admin_audit_logs l
        order by l.created_at desc, l.id desc
        limit 5
      ) r
    ), '[]'::jsonb)
  ) into result;

  perform public.record_admin_activity('Admin overview viewed', null, null, null, 'Overview refreshed');
  return result;
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_list_accounts(
  p_search text default null,
  p_role text default null,
  p_status text default null,
  p_limit int default 25,
  p_offset int default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  search_filter text := nullif(btrim(coalesce(p_search, '')), '');
  role_filter text := nullif(btrim(coalesce(p_role, '')), '');
  status_filter text := nullif(btrim(coalesce(p_status, '')), '');
  page_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
  page_offset int := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  with filtered as (
    select p.id, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    where (
        search_filter is null
        or coalesce(p.full_name, '') ilike '%' || search_filter || '%'
        or coalesce(u.email, '') ilike '%' || search_filter || '%'
        or coalesce(p.department, '') ilike '%' || search_filter || '%'
      )
      and (role_filter is null or p.role::text = role_filter)
      and (status_filter is null or p.status::text = status_filter)
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(public.admin_account_json(q.id) order by q.created_at desc, q.id)
      from (
        select f.id, f.created_at
        from filtered f
        order by f.created_at desc, f.id
        limit page_limit offset page_offset
      ) q
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered)
  ) into result;

  perform public.record_admin_activity(
    'Accounts viewed', null, null, null,
    format('search=%L role=%L status=%L', coalesce(search_filter, ''), coalesce(role_filter, ''), coalesce(status_filter, ''))
  );
  return result;
end;
$$;
revoke all on function public.admin_list_accounts(text, text, text, int, int) from public, anon;
grant execute on function public.admin_list_accounts(text, text, text, int, int) to authenticated;

create or replace function public.admin_list_doctor_applications(
  p_status text default 'pending',
  p_limit int default 25,
  p_offset int default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  status_filter text := nullif(btrim(coalesce(p_status, '')), '');
  page_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
  page_offset int := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  with filtered as (
    select a.user_id, a.created_at
    from public.doctor_applications a
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = a.user_id
    where status_filter is null or a.status = status_filter
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', q.user_id,
        'full_name', coalesce(p.full_name, ''),
        'email', u.email,
        'organisation', a.organisation,
        'registration_id', a.registration_id,
        'status', a.status,
        'review_note', a.review_note,
        'applied_at', a.created_at,
        'reviewed_at', a.reviewed_at,
        'email_confirmed', (u.email_confirmed_at is not null)
      ) order by a.created_at desc, q.user_id)
      from (
        select f.user_id, f.created_at
        from filtered f
        order by f.created_at desc, f.user_id
        limit page_limit offset page_offset
      ) q
      join public.profiles p on p.id = q.user_id
      join auth.users u on u.id = q.user_id
      join public.doctor_applications a on a.user_id = q.user_id
    ), '[]'::jsonb),
    'total', (select count(*)::int from filtered)
  ) into result;

  perform public.record_admin_activity(
    'Doctor applications viewed', null, null, null,
    format('status=%L', coalesce(status_filter, ''))
  );
  return result;
end;
$$;
revoke all on function public.admin_list_doctor_applications(text, int, int) from public, anon;
grant execute on function public.admin_list_doctor_applications(text, int, int) to authenticated;

create or replace function public.admin_review_doctor_application(
  p_user_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  application public.doctor_applications%rowtype;
  decision text := lower(btrim(coalesce(p_decision, '')));
  note text := nullif(btrim(coalesce(p_note, '')), '');
  confirmed_at timestamptz;
  target_label text;
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select * into application from public.doctor_applications a where a.user_id = p_user_id;
  if not found then
    raise exception 'Doctor application not found.';
  end if;
  if application.status <> 'pending' then
    raise exception 'This application has already been reviewed.';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  select u.email_confirmed_at into confirmed_at from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'Applicant account not found.';
  end if;
  if confirmed_at is null then
    raise exception 'The applicant must confirm their email address before review.';
  end if;

  select coalesce(nullif(p.full_name, ''), (select u.email from auth.users u where u.id = p.id), p.id::text)
    into target_label
  from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'Applicant account not found.';
  end if;

  if decision = 'approved' then
    if nullif(btrim(coalesce(application.registration_id, '')), '') is null then
      raise exception 'A registration number is required before approval.';
    end if;

    -- profiles.role is a literal so it works for both enum and text layouts.
    update public.profiles
    set role = 'doctor', department = application.organisation
    where id = p_user_id;

    update public.doctor_applications
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(),
        review_note = coalesce(note, review_note)
    where user_id = p_user_id;

    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"doctor"'::jsonb)
    where id = p_user_id;

    perform public.record_admin_activity(
      'Doctor application approved', p_user_id, target_label, null,
      coalesce(note, 'Application approved')
    );
  else
    if char_length(coalesce(note, '')) < 3 then
      raise exception 'A rejection reason of at least 3 characters is required.';
    end if;

    update public.doctor_applications
    set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(), review_note = note
    where user_id = p_user_id;

    perform public.record_admin_activity(
      'Doctor application rejected', p_user_id, target_label, null, note
    );
  end if;

  select public.admin_account_json(p_user_id) into result;
  return result;
end;
$$;
revoke all on function public.admin_review_doctor_application(uuid, text, text) from public, anon;
grant execute on function public.admin_review_doctor_application(uuid, text, text) to authenticated;

create or replace function public.admin_set_account_role(
  p_user_id uuid,
  p_role text,
  p_registration_id text default null,
  p_department text default null,
  p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles%rowtype;
  new_role text := lower(btrim(coalesce(p_role, '')));
  registration_id text := nullif(btrim(coalesce(p_registration_id, '')), '');
  department text := nullif(btrim(coalesce(p_department, '')), '');
  note text := nullif(btrim(coalesce(p_note, '')), '');
  active_admins int;
  target_label text;
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select * into target from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'Account not found.';
  end if;

  if new_role not in ('patient', 'doctor', 'admin') then
    raise exception 'Role must be patient, doctor or admin.';
  end if;

  if new_role = 'doctor' then
    if registration_id is null then
      raise exception 'A doctor registration number is required.';
    end if;
    if department is null then
      raise exception 'A doctor department is required.';
    end if;
  end if;

  -- Never leave the workspace without an active Admin.
  if target.role::text = 'admin' and target.status::text = 'active' and new_role <> 'admin' then
    select count(*)::int into active_admins
    from public.profiles p
    where p.role::text = 'admin' and p.status::text = 'active';
    if active_admins <= 1 then
      raise exception 'Cannot demote the only active admin.';
    end if;
  end if;

  select coalesce(nullif(p.full_name, ''), (select u.email from auth.users u where u.id = p.id), p.id::text)
    into target_label
  from public.profiles p where p.id = p_user_id;

  -- A doctor who stops being a doctor no longer holds patient assignments.
  if target.role::text = 'doctor' and new_role <> 'doctor' then
    delete from public.clinician_patient_assignments a where a.clinician_id = p_user_id;
  end if;

  if new_role = 'doctor' then
    insert into public.doctor_applications (
      user_id, registration_id, organisation, status, reviewed_at, reviewed_by, review_note
    ) values (
      p_user_id, registration_id, department, 'approved', now(), auth.uid(), note
    )
    on conflict (user_id) do update
    set registration_id = excluded.registration_id,
        organisation = excluded.organisation,
        status = 'approved',
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        review_note = coalesce(excluded.review_note, public.doctor_applications.review_note);
  end if;

  -- Sync Auth metadata before the profile write so a demoted doctor is treated as
  -- a Patient (and receives a Patient record) by the provisioning trigger.
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', to_jsonb(new_role))
  where id = p_user_id;

  execute format(
    'update public.profiles set role = %L, department = %L where id = $1',
    new_role,
    case when new_role = 'doctor' then department else null end
  ) using p_user_id;

  perform public.record_admin_activity(
    'Account role changed', p_user_id, target_label, null,
    format('role=%s->%s department=%L', target.role::text, new_role, coalesce(department, ''))
  );

  select public.admin_account_json(p_user_id) into result;
  return result;
end;
$$;
revoke all on function public.admin_set_account_role(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_set_account_role(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles%rowtype;
  new_status text := lower(btrim(coalesce(p_status, '')));
  active_admins int;
  target_label text;
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select * into target from public.profiles p where p.id = p_user_id;
  if not found then
    raise exception 'Account not found.';
  end if;

  if new_status not in ('active', 'suspended') then
    raise exception 'Status must be active or suspended.';
  end if;

  select coalesce(nullif(p.full_name, ''), (select u.email from auth.users u where u.id = p.id), p.id::text)
    into target_label
  from public.profiles p where p.id = p_user_id;

  if new_status = 'suspended' then
    if target.role::text = 'admin' and target.status::text = 'active' then
      select count(*)::int into active_admins
      from public.profiles p
      where p.role::text = 'admin' and p.status::text = 'active';
      if active_admins <= 1 then
        raise exception 'Cannot suspend the only active admin.';
      end if;
    end if;

    execute format('update public.profiles set status = %L where id = $1', 'suspended')
      using p_user_id;

    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;

    -- Suspension ends access: clinician assignments and patient-level assignment go.
    delete from public.clinician_patient_assignments a
    where a.clinician_id = p_user_id
      or a.patient_id = (select p.patient_id from public.profiles p where p.id = p_user_id);

    perform public.record_admin_activity(
      'Account suspended', p_user_id, target_label, null, 'Account access suspended'
    );
  else
    execute format('update public.profiles set status = %L where id = $1', 'active')
      using p_user_id;

    -- Reactivation lifts the ban; it does not re-create removed assignments.
    update auth.users set banned_until = null where id = p_user_id;

    perform public.record_admin_activity(
      'Account reactivated', p_user_id, target_label, null, 'Account access restored'
    );
  end if;

  select public.admin_account_json(p_user_id) into result;
  return result;
end;
$$;
revoke all on function public.admin_set_account_status(uuid, text) from public, anon;
grant execute on function public.admin_set_account_status(uuid, text) to authenticated;

create or replace function public.admin_list_patient_directory(
  p_search text default null,
  p_only_unassigned boolean default false,
  p_limit int default 25,
  p_offset int default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  search_filter text := nullif(btrim(coalesce(p_search, '')), '');
  unassigned_only boolean := coalesce(p_only_unassigned, false);
  page_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
  page_offset int := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  with directory as (
    select
      s."Patient Number"::text as patient_number,
      p.full_name as patient_name,
      a.clinician_id as assigned_doctor_id,
      d.full_name as assigned_doctor_name
    from public.patient_summary s
    left join public.profiles p on p.patient_id = s."Patient Number"
    left join public.clinician_patient_assignments a on a.patient_id = s."Patient Number"
    left join public.profiles d on d.id = a.clinician_id
    where (
        search_filter is null
        or s."Patient Number"::text ilike '%' || search_filter || '%'
        or coalesce(p.full_name, '') ilike '%' || search_filter || '%'
      )
      and (not unassigned_only or a.clinician_id is null)
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'patient_number', q.patient_number,
        'patient_name', q.patient_name,
        'assigned_doctor_id', q.assigned_doctor_id,
        'assigned_doctor_name', q.assigned_doctor_name
      ) order by q.patient_number)
      from (
        select * from directory
        order by patient_number
        limit page_limit offset page_offset
      ) q
    ), '[]'::jsonb),
    'total', (select count(*)::int from directory)
  ) into result;

  perform public.record_admin_activity(
    'Patient directory viewed', null, null, null,
    format('search=%L unassigned=%s', coalesce(search_filter, ''), unassigned_only)
  );
  return result;
end;
$$;
revoke all on function public.admin_list_patient_directory(text, boolean, int, int) from public, anon;
grant execute on function public.admin_list_patient_directory(text, boolean, int, int) to authenticated;

create or replace function public.admin_list_assignable_doctors()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'full_name', coalesce(p.full_name, ''),
    'email', u.email,
    'assignment_count', (
      select count(*)::int from public.clinician_patient_assignments a
      where a.clinician_id = p.id
    )
  ) order by coalesce(p.full_name, ''), p.id), '[]'::jsonb)
  into result
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role::text = 'doctor' and p.status::text = 'active';

  perform public.record_admin_activity(
    'Assignable doctors viewed', null, null, null, 'Care-team roster loaded'
  );
  return result;
end;
$$;
revoke all on function public.admin_list_assignable_doctors() from public, anon;
grant execute on function public.admin_list_assignable_doctors() to authenticated;

create or replace function public.admin_set_patient_assignment(
  p_patient_number text,
  p_doctor_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  patient_number text := nullif(btrim(coalesce(p_patient_number, '')), '');
  doctor_name text;
  assigned_at timestamptz;
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  if patient_number is null then
    raise exception 'Patient number is required.';
  end if;
  if not exists (
    select 1 from public.patient_summary s where s."Patient Number"::text = patient_number
  ) then
    raise exception 'Patient not found.';
  end if;

  if p_doctor_id is null then
    delete from public.clinician_patient_assignments a where a.patient_id = patient_number;
    perform public.record_admin_activity(
      'Patient unassigned', null, null, patient_number, 'Care-team assignment cleared'
    );
    return null;
  end if;

  select coalesce(nullif(p.full_name, ''), p.id::text) into doctor_name
  from public.profiles p
  where p.id = p_doctor_id
    and p.role::text = 'doctor'
    and p.status::text = 'active';
  if not found then
    raise exception 'Select an active, approved doctor.';
  end if;

  -- One active doctor per patient: replace atomically inside this transaction.
  delete from public.clinician_patient_assignments a where a.patient_id = patient_number;
  insert into public.clinician_patient_assignments (clinician_id, patient_id)
  values (p_doctor_id, patient_number)
  returning created_at into assigned_at;

  perform public.record_admin_activity(
    'Patient assigned', p_doctor_id, doctor_name, patient_number,
    format('Assigned to %s', doctor_name)
  );

  result := jsonb_build_object(
    'patient_number', patient_number,
    'assigned_doctor_id', p_doctor_id,
    'assigned_doctor_name', doctor_name,
    'created_at', assigned_at
  );
  return result;
end;
$$;
revoke all on function public.admin_set_patient_assignment(text, uuid) from public, anon;
grant execute on function public.admin_set_patient_assignment(text, uuid) to authenticated;

create or replace function public.admin_list_activity(
  p_category text default null,
  p_search text default null,
  p_limit int default 25,
  p_offset int default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  category_filter text := nullif(btrim(coalesce(p_category, '')), '');
  search_filter text := nullif(btrim(coalesce(p_search, '')), '');
  page_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
  page_offset int := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  with classified as (
    select
      l.id, l.action, l.actor_email, l.subject_user_id, l.subject_label,
      l.patient_id, l.detail, l.created_at,
      public.admin_activity_category(l.action) as category
    from public.admin_audit_logs l
    where (
      search_filter is null
      or l.action ilike '%' || search_filter || '%'
      or coalesce(l.actor_email, '') ilike '%' || search_filter || '%'
      or coalesce(l.subject_label, '') ilike '%' || search_filter || '%'
      or l.detail ilike '%' || search_filter || '%'
    )
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'category', q.category,
        'action', q.action,
        'actor_email', q.actor_email,
        'subject_user_id', q.subject_user_id,
        'subject_label', q.subject_label,
        'patient_id', q.patient_id,
        'detail', q.detail,
        'created_at', q.created_at
      ) order by q.created_at desc, q.id desc)
      from (
        select * from classified
        where category_filter is null or category = category_filter
        order by created_at desc, id desc
        limit page_limit offset page_offset
      ) q
    ), '[]'::jsonb),
    'total', (
      select count(*)::int from classified
      where category_filter is null or category = category_filter
    )
  ) into result;

  perform public.record_admin_activity(
    'Activity viewed', null, null, null,
    format('category=%L search=%L', coalesce(category_filter, ''), coalesce(search_filter, ''))
  );
  return result;
end;
$$;
revoke all on function public.admin_list_activity(text, text, int, int) from public, anon;
grant execute on function public.admin_list_activity(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS enforcement: active accounts only, doctors scoped to assignments
-- ---------------------------------------------------------------------------

-- Recreates the clinical read policies introduced by supabase_patient_dashboard.sql
-- with the production rule:
--   * the profile must belong to the caller and be active;
--   * admins read the cohort;
--   * doctors read only assigned patients (clinician alias kept for old tokens);
--   * patients read only their linked record.
-- The staff write boundary policies are intentionally left untouched.
do $$
declare
  table_name text;
  read_rule text := $rule$(
    auth.uid() is not null
    and public.current_account_active()
    and (
      coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') = 'admin'
      or (
        coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') in ('doctor', 'clinician')
        and exists (
          select 1 from public.clinician_patient_assignments a
          where a.clinician_id = auth.uid()
            and a.patient_id = "Patient Number"::text
        )
      )
      or (
        coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') = 'patient'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.patient_id = "Patient Number"::text
        )
      )
    )
  )$rule$;
begin
  foreach table_name in array array['patient_summary', 'patient_detail'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('drop policy if exists patient_dashboard_read on public.%I', table_name);
    execute format('create policy patient_dashboard_read on public.%I for select to authenticated using (%s)', table_name, read_rule);
    execute format('drop policy if exists patient_dashboard_read_boundary on public.%I', table_name);
    execute format('create policy patient_dashboard_read_boundary on public.%I as restrictive for select to anon, authenticated using (%s)', table_name, read_rule);
  end loop;
end;
$$;

-- Suspended patients must also receive nothing from the dashboard RPC.
-- SECURITY INVOKER retains table RLS; no caller-supplied user/record identifier.
create or replace function public.get_my_patient_dashboard()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'patient_id', p.patient_id),
    'summary', (
      select jsonb_build_object(
        'Patient Number', s."Patient Number"::text,
        'HbA1c (mmol/mol)', to_jsonb(s)->'HbA1c (mmol/mol)',
        'Fasting Plasma Glucose (mg/dl)', to_jsonb(s)->'Fasting Plasma Glucose (mg/dl)',
        'BMI (kg/m²)', to_jsonb(s)->'BMI (kg/m²)',
        'Weight (kg)', to_jsonb(s)->'Weight (kg)',
        'Type of Diabetes', to_jsonb(s)->'Type of Diabetes'
      )
      from public.patient_summary s where s."Patient Number"::text = p.patient_id
    ),
    'readings', coalesce((
      select jsonb_agg(r.row_data order by r.recorded_at desc nulls last)
      from (
        select d."Date" as recorded_at, jsonb_build_object(
          'Patient Number', d."Patient Number"::text,
          'Date', d."Date",
          'CGM (mg / dl)', to_jsonb(d)->'CGM (mg / dl)',
          'CBG (mg / dl)', to_jsonb(d)->'CBG (mg / dl)'
        ) as row_data
        from public.patient_detail d where d."Patient Number"::text = p.patient_id
        order by d."Date" desc nulls last limit 100
      ) r
    ), '[]'::jsonb)
  ) from public.profiles p where p.id = auth.uid()
    and public.current_account_active()
    and coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') = 'patient';
$$;
revoke all on function public.get_my_patient_dashboard() from public, anon;
grant execute on function public.get_my_patient_dashboard() to authenticated;

commit;

-- Operational notes:
--   * Restrictive profiles policies are unchanged; admins read other accounts only
--     through the SECURITY DEFINER RPCs above.
--   * Supabase default privileges may grant EXECUTE on new functions; the revokes
--     in this script are required and repeated on every function.
--   * Existing access tokens keep their old app_metadata role until the user signs
--     in again after a role change.
