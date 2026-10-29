-- Patient-specific Knowledge Graph access for Doctors.
-- Run in the Supabase SQL Editor after the application's profiles table exists.
-- Assignments are read with the requesting Doctor's Supabase JWT. Writes should
-- be managed through the SQL Editor or a trusted server-side admin process.

begin;

create table if not exists public.clinician_patient_assignments (
  clinician_id uuid not null references public.profiles(id) on delete cascade,
  patient_id text not null,
  created_at timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);

alter table public.clinician_patient_assignments enable row level security;
grant select on public.clinician_patient_assignments to authenticated;

drop policy if exists kg_assignment_owner_select on public.clinician_patient_assignments;
create policy kg_assignment_owner_select
  on public.clinician_patient_assignments
  for select to authenticated
  using (clinician_id = auth.uid());

-- A restrictive rule ensures another permissive policy cannot broaden access
-- to this assignment list. A Doctor can only query their own assignment rows.
drop policy if exists kg_assignment_owner_boundary on public.clinician_patient_assignments;
create policy kg_assignment_owner_boundary
  on public.clinician_patient_assignments
  as restrictive
  for select to authenticated
  using (clinician_id = auth.uid());

commit;

-- Example assignment; replace both values in the SQL Editor:
-- insert into public.clinician_patient_assignments (clinician_id, patient_id)
-- values ('<doctor-profile-uuid>'::uuid, '<Patient Number>')
-- on conflict (clinician_id, patient_id) do nothing;

-- Verify the logged-in Doctor's own assignments:
-- select patient_id, created_at
-- from public.clinician_patient_assignments
-- where clinician_id = auth.uid()
-- order by patient_id;
