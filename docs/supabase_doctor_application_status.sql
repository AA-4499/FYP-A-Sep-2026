-- Existing-table repair: read only the current account's application status.
-- Run in Supabase SQL Editor. No tables, records or existing policies are changed.
begin;

create or replace function public.get_my_doctor_application_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', a.user_id, 'status', a.status)
  from public.doctor_applications a
  where a.user_id = auth.uid() and auth.uid() is not null;
$$;
revoke all on function public.get_my_doctor_application_status() from public, anon, authenticated;
grant execute on function public.get_my_doctor_application_status() to authenticated;

commit;
