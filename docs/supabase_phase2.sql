-- Phase 2: Supabase Auth, roles, assignments, audit logs, and RLS.
create type public.app_role as enum ('patient', 'clinician', 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'patient',
  patient_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.clinician_patient_assignments (
  clinician_id uuid not null references public.profiles(id) on delete cascade,
  patient_id text not null,
  created_at timestamptz not null default now(),
  primary key (clinician_id, patient_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('view', 'export')),
  patient_id text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), 'patient')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.my_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.clinician_patient_assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.my_role() in ('clinician','admin'));
create policy profiles_admin_update on public.profiles for update using (public.my_role() = 'admin');
create policy assignment_visible_to_owner on public.clinician_patient_assignments for select using (clinician_id = auth.uid() or public.my_role() = 'admin');
create policy audit_insert_authenticated on public.audit_logs for insert with check (actor_id = auth.uid());
create policy audit_admin_read on public.audit_logs for select using (public.my_role() = 'admin');

-- Apply equivalent policies to patient_summary and patient_detail after confirming
-- the patient identifier column name in the deployed schema.
-- Example policy shape:
-- using (public.my_role() = 'admin'
--   or (public.my_role() = 'clinician' and exists (select 1 from public.clinician_patient_assignments a where a.clinician_id = auth.uid() and a.patient_id = "Patient Number"))
--   or (public.my_role() = 'patient' and "Patient Number" = auth.jwt()->>'patient_id'));




