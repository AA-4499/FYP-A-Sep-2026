-- Existing installations: rename the clinician role to doctor without adding a fourth role.
-- Run after the original supabase_phase2.sql. Safe to rerun on the updated schema.
begin;

do $$
begin
  if exists (
    select 1 from pg_enum
    where enumtypid = 'public.app_role'::regtype and enumlabel = 'clinician'
  ) then
    alter type public.app_role rename value 'clinician' to 'doctor';
  end if;
end;
$$;

-- Enum-backed profile values and policies follow the renamed value automatically.
-- Trusted Auth metadata is JSON, so it needs an explicit update.
update auth.users
set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"doctor"'::jsonb)
where raw_app_meta_data->>'role' = 'clinician';

commit;

-- Existing access tokens continue to work through the API's clinician -> doctor alias.
-- Sign in again to receive updated role claims.
