-- Demo account seed for the Smart Diabetes Digital Twin prototype.
-- Source patient: web/frontend/src/data/patientsData.ts
--
-- IMPORTANT: Create the two users first in Supabase Dashboard > Authentication > Users
-- (or with the Supabase Admin API). Do not store passwords in this repository.
-- Then run this SQL in the Supabase SQL Editor after the role schema/migration.
-- The existing doctor demo email is retained for compatibility.

insert into public.profiles (id, full_name, role, patient_id)
select id, 'Elena Morales', 'patient'::public.app_role, '2000_0_20201230'
from auth.users
where lower(email) = lower('elena.patient@example.com')
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role,
  patient_id = excluded.patient_id;

insert into public.profiles (id, full_name, role)
select id, 'Dr. Andy Wong', 'doctor'::public.app_role
from auth.users
where lower(email) = lower('andy.clinician@example.com')
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role;

insert into public.clinician_patient_assignments (clinician_id, patient_id)
select clinician.id, '2000_0_20201230'
from public.profiles clinician
join auth.users clinician_user on clinician_user.id = clinician.id
where lower(clinician_user.email) = lower('andy.clinician@example.com')
on conflict (clinician_id, patient_id) do nothing;

-- Verification: this should return both seeded profiles and one assignment.
select p.id, p.full_name, p.role, p.patient_id
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) in ('elena.patient@example.com', 'andy.clinician@example.com');

select * from public.clinician_patient_assignments
where patient_id = '2000_0_20201230';
