-- Run AFTER supabase_admin_workspace.sql. Reapply this last if older migrations
-- are rerun. Invitation details are private; only active admins can reserve them.
begin;

create table if not exists public.doctor_invitations (
  email text primary key,
  token uuid not null unique default gen_random_uuid(),
  full_name text not null,
  organisation text not null,
  department text not null,
  registration_id text not null,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '1 hour',
  consumed_at timestamptz
);
alter table public.doctor_invitations enable row level security;
revoke all on public.doctor_invitations from public, anon, authenticated;

create or replace function public.admin_prepare_doctor_invitation(
  p_email text, p_full_name text, p_organisation text,
  p_department text, p_registration_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  invitation_token uuid;
  target_email text := lower(btrim(p_email));
begin
  if not public.is_active_admin() then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;
  if target_email is null or char_length(target_email) > 254
     or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or coalesce(char_length(btrim(p_full_name)), 0) not between 1 and 120
     or coalesce(char_length(btrim(p_organisation)), 0) not between 1 and 160
     or coalesce(char_length(btrim(p_department)), 0) not between 1 and 160
     or coalesce(char_length(btrim(p_registration_id)), 0) not between 1 and 120
     or concat(p_email, p_full_name, p_organisation, p_department, p_registration_id) ~ '[[:cntrl:]]' then
    raise exception 'Complete all doctor information with valid values.' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = target_email) then
    raise exception 'An account already exists for this email.' using errcode = '23505';
  end if;
  insert into public.doctor_invitations (email, full_name, organisation, department, registration_id, invited_by)
  values (target_email, btrim(p_full_name), btrim(p_organisation), btrim(p_department), btrim(p_registration_id), auth.uid())
  on conflict (email) do update set
    token = gen_random_uuid(), full_name = excluded.full_name, organisation = excluded.organisation,
    department = excluded.department, registration_id = excluded.registration_id,
    invited_by = excluded.invited_by, expires_at = now() + interval '1 hour', consumed_at = null
  returning token into invitation_token;
  return jsonb_build_object('token', invitation_token);
end;
$$;
revoke all on function public.admin_prepare_doctor_invitation(text, text, text, text, text) from public, anon;
grant execute on function public.admin_prepare_doctor_invitation(text, text, text, text, text) to authenticated;

-- BEFORE Auth inserts: bind a server-created invite to its reserved email and
-- current administrator. User-editable metadata alone can never confer a role.
create or replace function public.validate_doctor_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invitation public.doctor_invitations%rowtype;
begin
  if new.raw_user_meta_data ? 'doctor_invitation_token' then
    select * into invitation from public.doctor_invitations
      where token::text = new.raw_user_meta_data->>'doctor_invitation_token'
        and email = lower(new.email) and consumed_at is null and expires_at > now()
      for update;
    if not found then
      raise exception 'A valid administrator invitation is required.' using errcode = '42501';
    end if;
    -- Lock until the Auth transaction commits, preventing concurrent suspension
    -- or demotion from slipping between the live check and account creation.
    perform 1 from public.profiles where id = invitation.invited_by
      and role::text = 'admin' and status::text = 'active' for share;
    if not found then
      raise exception 'Active admin access required.' using errcode = '42501';
    end if;
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'doctor', 'doctor_invitation', invitation.token);
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      - 'doctor_invitation_token'
      || jsonb_build_object('full_name', invitation.full_name, 'organisation', invitation.organisation,
                           'registration_id', invitation.registration_id);
    update public.doctor_invitations set consumed_at = now() where email = invitation.email;
  elsif coalesce(new.raw_user_meta_data->>'requested_role', '') in ('doctor', 'clinician')
     or coalesce(new.raw_user_meta_data->>'role', '') in ('doctor', 'clinician') then
    raise exception 'Doctor accounts are invitation only. Contact an administrator.' using errcode = '42501';
  elsif exists (select 1 from public.doctor_invitations
      where email = lower(new.email) and consumed_at is null and expires_at > now()) then
    raise exception 'This email is reserved for an administrator invitation.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_doctor_invitation() from public, anon, authenticated;
drop trigger if exists validate_doctor_invitation on auth.users;
create trigger validate_doctor_invitation before insert on auth.users
  for each row execute function public.validate_doctor_invitation();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  invitation public.doctor_invitations%rowtype;
begin
  select * into invitation from public.doctor_invitations
    where token::text = new.raw_app_meta_data->>'doctor_invitation' and email = lower(new.email)
      and consumed_at is not null;
  if found then
    insert into public.profiles (id, full_name, role, department)
      values (new.id, invitation.full_name, 'doctor', invitation.department);
    insert into public.doctor_applications (user_id, registration_id, organisation, status, reviewed_by, reviewed_at, review_note)
      values (new.id, invitation.registration_id, invitation.organisation, 'approved', invitation.invited_by, now(), 'Added by administrator invitation.');
    insert into public.admin_audit_logs (actor_id, actor_email, action, subject_user_id, subject_label, detail)
      select invitation.invited_by, u.email, 'Doctor invited', new.id, invitation.full_name,
             'Doctor account created through an administrator invitation.'
      from auth.users u where u.id = invitation.invited_by;
  else
    insert into public.profiles (id, full_name, role, nric_passport_no)
      values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), 'patient',
        nullif(btrim(new.raw_user_meta_data->>'nric_passport_no'), ''))
      on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Retire the old self-application approval path. Preserve historical rows.
create or replace function public.admin_review_doctor_application(
  p_user_id uuid, p_decision text, p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_active_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  raise exception 'Doctor onboarding now requires an administrator invitation.';
end;
$$;

-- The generic role editor must not bypass invitation onboarding.
create or replace function public.require_invitation_for_doctor_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role::text = 'doctor' and old.role::text <> 'doctor' then
    raise exception 'Add doctors using an administrator invitation.';
  end if;
  return new;
end;
$$;
revoke all on function public.require_invitation_for_doctor_role() from public, anon, authenticated;
drop trigger if exists require_invitation_for_doctor_role on public.profiles;
create trigger require_invitation_for_doctor_role before update of role on public.profiles
  for each row execute function public.require_invitation_for_doctor_role();

commit;
