-- Integrates Doctor registration with the existing profiles and doctor_applications tables.
-- Run LAST, after the current patient registration, dashboard and auto-provision scripts.
-- Reapply the current supabase_patient_auto_provision.sql when upgrading an installation.
begin;

-- Require the supplied schema rather than creating or changing table definitions.
do $$
declare missing_columns text;
begin
  select string_agg(required.table_name || '.' || required.column_name, ', ')
    into missing_columns
    from (values
      ('profiles', 'id'), ('profiles', 'full_name'), ('profiles', 'role'),
      ('profiles', 'patient_id'), ('profiles', 'nric_passport_no'),
      ('doctor_applications', 'user_id'), ('doctor_applications', 'registration_id'),
      ('doctor_applications', 'organisation'), ('doctor_applications', 'status'),
      ('doctor_applications', 'review_note'), ('doctor_applications', 'reviewed_at'),
      ('doctor_applications', 'reviewed_by'), ('doctor_applications', 'created_at')
    ) as required(table_name, column_name)
    where not exists (select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = required.table_name
        and c.column_name = required.column_name);
  if missing_columns is not null then
    raise exception 'Doctor registration requires these existing columns: %', missing_columns;
  end if;
end;
$$;
-- Reuse the existing eight-column table. Names belong to profiles.full_name.
-- Validate new submissions in the trigger without rewriting legacy nullable rows.
alter table public.doctor_applications enable row level security;
revoke all on public.doctor_applications from public, anon, authenticated;
grant select on public.doctor_applications to authenticated;
grant all on public.doctor_applications to service_role;
drop policy if exists doctor_application_self_read on public.doctor_applications;
create policy doctor_application_self_read on public.doctor_applications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists doctor_application_private_read on public.doctor_applications;
create policy doctor_application_private_read on public.doctor_applications as restrictive
  for select to anon, authenticated using (user_id = auth.uid());

-- An owner-scoped lookup avoids dependencies on older profile/admin RLS policies.
-- It exposes only status and accepts no caller-supplied account identifier.
create or replace function public.get_my_doctor_application_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', a.user_id, 'status', a.status)
  from public.doctor_applications a
  where a.user_id = auth.uid() and auth.uid() is not null;
$$;
revoke all on function public.get_my_doctor_application_status() from public, anon, authenticated;
grant execute on function public.get_my_doctor_application_status() to authenticated;

-- The editable requested_role is an application request, never an access grant.
-- Snapshot details once; subsequent user_metadata edits cannot change the review.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_doctor_application boolean := new.raw_user_meta_data->>'requested_role' = 'doctor'
    and coalesce(new.raw_app_meta_data->>'role', 'patient') = 'patient';
  applicant_name text := btrim(new.raw_user_meta_data->>'full_name');
  applicant_organisation text := btrim(new.raw_user_meta_data->>'organisation');
  -- Accept the old form's metadata key during deployment; storage uses registration_id.
  applicant_registration text := btrim(coalesce(new.raw_user_meta_data->>'registration_id',
    new.raw_user_meta_data->>'professional_registration_number'));
begin
  if is_doctor_application then
    if coalesce(char_length(applicant_name), 0) not between 1 and 120
      or applicant_name ~ '[[:cntrl:]]'
      or coalesce(char_length(applicant_organisation), 0) not between 1 and 200
      or applicant_organisation ~ '[[:cntrl:]]'
      or coalesce(char_length(applicant_registration), 0) not between 1 and 64
      or applicant_registration ~ '[[:cntrl:]]' then
      raise exception 'Enter a valid Doctor name, organisation and professional registration number.';
    end if;
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || '{"role":"patient","doctor_registration_status":"pending"}'::jsonb
      where id = new.id;
  end if;
  insert into public.profiles (id, full_name, role, nric_passport_no)
  values (new.id, case when is_doctor_application then applicant_name
      else left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120) end, 'patient',
    nullif(btrim(new.raw_user_meta_data->>'nric_passport_no'), ''))
  on conflict (id) do nothing;
  -- Create the profile first: existing installations may reference profiles(id).
  -- Its status and department retain their database defaults.
  if is_doctor_application then
    insert into public.doctor_applications (user_id, registration_id, organisation)
    values (new.id, applicant_registration, applicant_organisation);
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Pending applicants cannot access clinical data, even with a stale profile link.
do $$
declare clinical_table text;
begin
  foreach clinical_table in array array['patient_summary', 'patient_detail'] loop
    execute format('drop policy if exists doctor_pending_boundary on public.%I', clinical_table);
    execute format('create policy doctor_pending_boundary on public.%I as restrictive
      for all to anon, authenticated
      using (coalesce(auth.jwt()->''app_metadata''->>''doctor_registration_status'', '''') <> ''pending'')
      with check (coalesce(auth.jwt()->''app_metadata''->>''doctor_registration_status'', '''') <> ''pending'')', clinical_table);
  end loop;
end;
$$;

-- Only a trusted operator (SQL Editor) or server service role may approve.
-- Browser Admin pages in this repository remain a demo and cannot invoke this.
create or replace function public.approve_doctor_application(applicant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.doctor_applications where user_id = applicant_id and status = 'pending' for update;
  if not found then raise exception 'No pending Doctor application exists for this account.'; end if;
  perform 1 from auth.users where id = applicant_id and email_confirmed_at is not null for update;
  if not found then raise exception 'The applicant must confirm their email before approval.'; end if;
  update public.profiles set role = 'doctor' where id = applicant_id;
  if not found then raise exception 'The applicant profile is missing.'; end if;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"role":"doctor","doctor_registration_status":"approved"}'::jsonb
    where id = applicant_id;
  update public.doctor_applications set status = 'approved', reviewed_at = now() where user_id = applicant_id;
end;
$$;
revoke all on function public.approve_doctor_application(uuid) from public, anon, authenticated;
grant execute on function public.approve_doctor_application(uuid) to service_role;

commit;
