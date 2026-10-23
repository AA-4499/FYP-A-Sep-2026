-- Run after supabase_patient_registration.sql and supabase_patient_dashboard.sql.
-- New Patient profiles receive a new Patient Number and an empty patient_summary row.
-- Existing unlinked Patients are provisioned; existing links and clinical rows are preserved.
begin;

-- Serialize setup/backfill with profile writes so signups cannot miss the new trigger.
lock table public.profiles in share row exclusive mode;

-- Do not silently invent measurements to satisfy an incompatible imported schema.
do $$
declare incompatible_columns text;
begin
  if not exists (
    select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'patient_summary' and column_name = 'Patient Number'
      and data_type in ('text', 'character varying')
      and (character_maximum_length is null or character_maximum_length >= 22)
  ) then
    raise exception 'patient_summary."Patient Number" must be text or varchar(22+) before automatic registration can be enabled.';
  end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into incompatible_columns
    from information_schema.columns
    where table_schema = 'public' and table_name = 'patient_summary'
      and column_name <> 'Patient Number' and is_nullable = 'NO'
      and is_identity = 'NO' and is_generated = 'NEVER'
      and not (column_name in ('id', 'created_at', 'updated_at') and column_default is not null);
  if incompatible_columns is not null then
    raise exception 'Empty Patient records require nullable clinical columns. Review these required columns first: %', incompatible_columns;
  end if;
end;
$$;

-- Constraints also protect assignments made outside this trigger.
-- Duplicated legacy links or record numbers cause a rollback, not a silent reassignment.
create unique index if not exists patient_summary_number_unique
  on public.patient_summary ("Patient Number");
create unique index if not exists profiles_patient_number_unique
  on public.profiles (patient_id) where patient_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_patient_record_fkey') then
    alter table public.profiles add constraint profiles_patient_record_fkey
      foreign key (patient_id) references public.patient_summary ("Patient Number")
      on update restrict on delete restrict;
  end if;
end;
$$;

create sequence if not exists public.patient_number_seq start with 1;
revoke all on sequence public.patient_number_seq from public, anon, authenticated;

create or replace function public.provision_patient_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  sequence_value text;
  generated_number text;
  empty_columns text;
  empty_values text;
  account_role text;
begin
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

-- The profile trigger handles both new registrations and this one-time backfill.
-- No record is reassigned and no existing name/NRIC/role is overwritten.
update public.profiles p set patient_id = null
from auth.users u
where p.id = u.id and p.role::text = 'patient' and p.patient_id is null
  and coalesce(u.raw_app_meta_data->>'role', 'patient') = 'patient';

commit;

-- Patient Number is an identifier, not a credential. RLS from the earlier scripts
-- remains the access boundary. Sequence gaps after rolled-back signups are normal.
