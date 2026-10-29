-- Apply after supabase_admin_workspace.sql. Saved predictions are immutable snapshots.
begin;
create table if not exists public.patient_prediction_results (
  id uuid primary key,
  patient_id text not null references public.patient_summary("Patient Number"),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  event_summary text not null check (length(event_summary) <= 4000),
  engine text not null check (engine in ('gru', 'physiology')),
  output jsonb not null check (jsonb_typeof(output) = 'object' and coalesce(output->>'patient_id' = patient_id, false)),
  scenario jsonb,
  model_sha256 text not null
);
create index if not exists patient_prediction_results_patient_time_idx
  on public.patient_prediction_results(patient_id, created_at desc);
alter table public.patient_prediction_results enable row level security;
revoke all on public.patient_prediction_results from public, anon, authenticated;
grant select, insert on public.patient_prediction_results to authenticated;

create or replace function public.can_access_prediction_results(p_patient_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status::text = 'active'
    and (p.role::text = 'admin'
      or (p.role::text = 'patient' and p.patient_id = p_patient_id)
      or (p.role::text in ('doctor', 'clinician') and exists (
        select 1 from public.clinician_patient_assignments a
        where a.clinician_id = p.id and a.patient_id = p_patient_id)))
  );
$$;
revoke all on function public.can_access_prediction_results(text) from public, anon;
grant execute on function public.can_access_prediction_results(text) to authenticated;
drop policy if exists prediction_results_read on public.patient_prediction_results;
create policy prediction_results_read on public.patient_prediction_results for select to authenticated
  using (public.can_access_prediction_results(patient_id));
drop policy if exists prediction_results_save on public.patient_prediction_results;
create policy prediction_results_save on public.patient_prediction_results for insert to authenticated
  with check (created_by = auth.uid() and public.can_access_prediction_results(patient_id));
commit;
