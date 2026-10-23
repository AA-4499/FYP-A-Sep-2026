-- Patient authentication milestone. Review and run in the existing project's SQL Editor.
-- This creates account profiles only; it does not grant access to clinical records.
begin;

-- Compatible with the earlier profiles table, whose role column may be an enum.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'patient' check (role in ('admin', 'patient', 'doctor')),
  patient_id text,
  created_at timestamptz not null default now()
);
-- Also upgrades installations where profiles was created by an earlier script.
-- Existing accounts keep NULL; their identity numbers must not be guessed.
alter table public.profiles add column if not exists nric_passport_no text
  check (nric_passport_no is null or (char_length(btrim(nric_passport_no)) between 1 and 64
    and nric_passport_no !~ '[[:cntrl:]]'));
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;

drop policy if exists registration_profile_self_read on public.profiles;
create policy registration_profile_self_read on public.profiles
  for select to authenticated using (id = auth.uid());

-- Profiles now contain identity numbers. Constrain older broad read policies too.
-- Trusted administration must access other users through a server-side service role.
drop policy if exists registration_profile_private_read on public.profiles;
create policy registration_profile_private_read on public.profiles as restrictive
  for select to anon, authenticated using (id = auth.uid());

-- Public registration always starts as Patient. Requested role and patient_id
-- from editable signup metadata must never grant elevated permissions or record access.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, nric_passport_no)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), 'patient',
    nullif(btrim(new.raw_user_meta_data->>'nric_passport_no'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Preserve existing profiles and their role/record links. Provision missing ones.
insert into public.profiles (id, full_name, role)
select id, left(coalesce(raw_user_meta_data->>'full_name', ''), 120), 'patient'
from auth.users
on conflict (id) do nothing;

-- Block self-service role/record edits even if an older permissive policy exists.
-- Future trusted administration should write through a server-side service role.
drop policy if exists registration_no_client_insert on public.profiles;
create policy registration_no_client_insert on public.profiles as restrictive
  for insert to anon, authenticated with check (false);
drop policy if exists registration_no_client_update on public.profiles;
create policy registration_no_client_update on public.profiles as restrictive
  for update to anon, authenticated using (false) with check (false);
drop policy if exists registration_no_client_delete on public.profiles;
create policy registration_no_client_delete on public.profiles as restrictive
  for delete to anon, authenticated using (false);

commit;
