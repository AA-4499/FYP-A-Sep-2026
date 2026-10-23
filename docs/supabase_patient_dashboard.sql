-- Run AFTER supabase_patient_registration.sql in the Supabase SQL Editor.
-- Uses existing tables; does not create or assign any medical records.
-- Restricts direct clinical reads as well as the dashboard RPC. Existing broad
-- policies cannot bypass the restrictive policies below. Trusted Doctor/Admin
-- accounts retain cohort read access; Patient accounts can read only their link.
begin;

-- The link is an authorization boundary: browser clients must not change it.
alter table public.profiles enable row level security;
drop policy if exists registration_no_client_insert on public.profiles;
create policy registration_no_client_insert on public.profiles as restrictive
  for insert to anon, authenticated with check (false);
drop policy if exists registration_no_client_update on public.profiles;
create policy registration_no_client_update on public.profiles as restrictive
  for update to anon, authenticated using (false) with check (false);
drop policy if exists registration_no_client_delete on public.profiles;
create policy registration_no_client_delete on public.profiles as restrictive
  for delete to anon, authenticated using (false);
drop policy if exists registration_profile_private_read on public.profiles;
create policy registration_profile_private_read on public.profiles as restrictive
  for select to anon, authenticated using (id = auth.uid());

-- These are the clinical table/identifier names used by this repository.
-- If a deployed name differs, the transaction fails without partially applying.
do $$
declare
  table_name text;
  read_rule text := $rule$(
    auth.uid() is not null and (
      coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') in ('admin', 'doctor', 'clinician')
      or (
        coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') = 'patient'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.patient_id = "Patient Number"::text
        )
      )
    )
  )$rule$;
  staff_rule text := $rule$(auth.uid() is not null and
    coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') in ('admin', 'doctor', 'clinician'))$rule$;
begin
  foreach table_name in array array['patient_summary', 'patient_detail'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('drop policy if exists patient_dashboard_read on public.%I', table_name);
    execute format('create policy patient_dashboard_read on public.%I for select to authenticated using (%s)', table_name, read_rule);
    execute format('drop policy if exists patient_dashboard_read_boundary on public.%I', table_name);
    execute format('create policy patient_dashboard_read_boundary on public.%I as restrictive for select to anon, authenticated using (%s)', table_name, read_rule);
    -- Preserve any staff write policies, while preventing patient/anonymous writes.
    execute format('drop policy if exists patient_dashboard_insert_boundary on public.%I', table_name);
    execute format('create policy patient_dashboard_insert_boundary on public.%I as restrictive for insert to anon, authenticated with check (%s)', table_name, staff_rule);
    execute format('drop policy if exists patient_dashboard_update_boundary on public.%I', table_name);
    execute format('create policy patient_dashboard_update_boundary on public.%I as restrictive for update to anon, authenticated using (%s) with check (%s)', table_name, staff_rule, staff_rule);
    execute format('drop policy if exists patient_dashboard_delete_boundary on public.%I', table_name);
    execute format('create policy patient_dashboard_delete_boundary on public.%I as restrictive for delete to anon, authenticated using (%s)', table_name, staff_rule);
  end loop;
end;
$$;

-- SECURITY INVOKER retains table RLS. No caller-supplied user/record identifier.
-- Null measurements remain null; no demo records, inferred risks, or ID numbers.
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
    and coalesce(auth.jwt()->'app_metadata'->>'role', 'patient') = 'patient';
$$;
revoke all on function public.get_my_patient_dashboard() from public, anon;
grant execute on function public.get_my_patient_dashboard() to authenticated;
commit;
