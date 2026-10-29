# Admin operations runbook

The Admin workspace is backed by Supabase. Every screen reads database views/functions; every
mutation runs a `SECURITY DEFINER` database function that re-checks the caller's **current**
`profiles.role = 'admin'` and `profiles.status = 'active'`. Nothing is stored in the browser and no
service-role key is shipped to the frontend.

## 1. Apply the migrations (once per environment)

Run these in the Supabase SQL Editor, in order, as the project owner (`postgres`):

1. `supabase_doctor_role_migration.sql` (only for existing installations)
2. `supabase_patient_registration.sql`
3. `supabase_patient_auto_provision.sql`
4. `supabase_patient_dashboard.sql`
5. `supabase_admin_workspace.sql`

The admin migration is transactional and idempotent: it creates `profiles.status`,
`profiles.department`, `doctor_applications`, `admin_audit_logs`, all `admin_*` functions, the
`handle_new_user` / patient-provisioning trigger changes, and the enforced clinical RLS rules.
It can be rerun safely after a failure.

> Order matters relative to the frontend: apply the SQL **before** deploying the frontend build that
> uses the new access-state RPC (`get_my_access_state`). Until the SQL is applied, signed-in users see
> "Account verification is not configured yet".

## 2. Bootstrap the first administrator (required once)

Admin accounts are never created from the Admin UI. Create the person's auth user first (Dashboard →
Authentication → Users, "Add user", or have them register as a Patient), then promote that account.
The **User accounts** screen manages existing identities; it does not create a Supabase Auth user or
send an invitation. This boundary avoids putting a service-role credential in the browser:

```sql
-- Replace the email with the real administrator account.
update public.profiles p
set role = 'admin',
    status = 'active'
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@example.com');

update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin"'::jsonb)
where lower(email) = lower('admin@example.com');
```

Both statements are needed: `profiles.role` is what the RPCs and the new access gate check, while
`auth.users.raw_app_meta_data.role` keeps the Supabase JWT claim (and therefore the Flask API's
role check) in sync. Run both inside one SQL Editor transaction. Verify:

```sql
select p.role, p.status, u.email
from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = lower('admin@example.com');
```

Sign out and back in so a fresh JWT is issued. Admin accounts cannot demote or suspend the last
remaining active administrator.

## 3. Doctor onboarding

1. The applicant uses **Doctor? Apply to join your care workspace** on the sign-in page. This creates
   a normal Supabase account (role stays `patient`) plus a pending row in `doctor_applications`.
   Doctor applicants are **not** given a patient clinical record.
2. The applicant confirms their email. Approval is blocked until the email is confirmed and a
   professional registration number exists.
3. An administrator opens **Doctor approvals**, reviews the registration/organisation, optionally
   writes a review note, and approves or declines. Approval sets `profiles.role = 'doctor'`,
   copies the department/organisation, marks the application approved and syncs the JWT role. Declines
   require a reason; the applicant sees it after sign-in.
4. The new Doctor signs out and back in to receive the Doctor workspace. If a Doctor account already
   exists, **User accounts → Manage** can change its role, department or registration directly.

## 4. Patient assignments (care-team scoping)

Doctors only see and forecast patients assigned to them. Assignments live in
`clinician_patient_assignments` and are managed in **Patient assignments**: pick an active Doctor per
patient, Save, or clear the row to unassign. Each patient has at most one assigned Doctor; assigning
replaces the previous one.

> Operational note: when this migration is first applied, existing Doctor accounts have no assignments
> and will see an empty patient list until an administrator assigns patients. This is intentional.

## 5. Suspension and reactivation

**User accounts → Manage** suspends or reactivates an account. Suspension:

- sets `profiles.status = 'suspended'` (the access gate and every admin RPC deny immediately),
- sets `auth.users.banned_until` far in the future so Supabase blocks new sessions and refreshes,
- removes that account's care assignments.

Reactivating restores `status = 'active'` and clears the ban; the person signs in again. Suspended
accounts keep their profile and medical record link — nothing is deleted.

## 6. Audit history

Every admin RPC call currently appends one row to `admin_audit_logs` in the same transaction,
including overview and directory reads. The **Activity history** page and the Overview's recent list
read this table; the CSV export is generated in the browser from the returned rows (no audit rows are
written for exports).

## 7. Verification checklist

Run after applying the SQL and deploying the frontend:

1. Admin signs in → real overview with account counts, pending applications and recent activity; no
   "Demo workspace"/"Reset demo"; `localStorage` has no `diatwin.admin-demo.v1` key.
2. A non-Admin session cannot call the RPCs. With any Doctor/Patient access token:
   `POST {SUPABASE_URL}/rest/v1/rpc/admin_list_accounts` returns an error (`42501 Admin access
   required`), never rows.
3. Doctor application → approval → the applicant signs in as Doctor and sees the Doctor workspace.
4. Assign a patient to a Doctor; the Doctor's patient list contains only assigned patients (direct
   REST reads of unassigned `patient_summary` rows return `[]`; the Flask forecast endpoint returns
   403 for unassigned patients).
5. Suspend a Doctor: the account can no longer sign in, their assignments disappear, and
   `admin_audit_logs` shows the suspension.
6. Confirm `admin_audit_logs` row count increases only after mutations.

Useful SQL checks:

```sql
select role::text, status::text, count(*) from public.profiles group by 1, 2 order by 1, 2;
select action, actor_email, subject_label, created_at
from public.admin_audit_logs order by created_at desc limit 20;
select count(*) from public.doctor_applications where status = 'pending';
select * from public.clinician_patient_assignments order by created_at desc limit 20;
```

## 8. Rollback

The migration is additive; to roll back, restore the previous `get_my_patient_dashboard` /
`handle_new_user` / `provision_patient_record` definitions and the previous clinical read policies
from `supabase_patient_dashboard.sql`, then drop the new tables/functions. Deploy the previous
frontend build in the same window. A database backup before applying is recommended.

## 9. Security boundaries

- The browser never holds a service-role key; Admin RPCs only manage existing accounts and profiles,
  never create or delete auth users or send emails.
- `profiles` and clinical tables remain unreadable/unwritable for other users through direct PostgREST
  calls; the Admin screens use guarded `SECURITY DEFINER` functions instead of broad policies.
- Identity numbers (`nric_passport_no`) are deliberately excluded from Admin list responses.
- Admin screens manage people and access, not clinical measurements. The existing clinical reporting
  surfaces are unchanged.
