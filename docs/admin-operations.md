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
6. `supabase_doctor_invitations.sql` (always apply last, including after rerunning older migrations)

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
The **Add doctor** screen creates Doctor accounts through the Flask invitation endpoint.
Server credentials stay in the backend. Bootstrap Admin accounts separately:

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

## 3. Doctor onboarding by invitation

1. An **active Admin** opens **Add doctor** and enters the full name, email, organisation / clinic,
   department / care group, and professional registration number. All fields are required.
2. **Send invitation** calls `POST /api/admin/doctors/invite` with the administrator's access token.
   The database re-checks the current role and status, reserves the email, and validates the details.
   The backend uses its server-only Supabase key to send the invitation email.
3. Account creation re-checks the inviting administrator under a database lock. A Doctor profile,
   professional details, trusted Auth role, and audit record are created together. No patient record
   is created for the Doctor. User-editable metadata cannot grant access.
4. The Doctor opens the email link, chooses and confirms a password, then signs in to the Doctor
   workspace. The password setup verifies both the invitation identity and live account access.
5. Assign patients from **Patient assignments**. Existing Doctor accounts remain available.

Public Doctor applications and promotions to Doctor through the role editor are disabled. Historical
applications remain in the database; the old approval RPC cannot grant access. Existing account emails
cannot be invited again or silently overwritten. An expired invitation can be recovered using
**Forgot password?** with the invited email; suspended accounts still cannot access the workspace.

### Deployment configuration

- Apply `docs/supabase_doctor_invitations.sql` after the admin migration, then deploy both backend
  and frontend. Do not rerun the older migrations without reapplying the invitation migration last.
- Configure the existing backend `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or service-role key).
  Never put the secret key in any `VITE_*` variable.
- Set `DOCTOR_INVITE_REDIRECT_URL=https://YOUR-APP/?auth=invite` on the backend. For local development,
  `http://localhost:5173/?auth=invite` is supported. The client cannot override this destination.
- Add that exact URL to **Supabase Authentication > URL Configuration > Redirect URLs**. Set the
  Site URL to the application origin. Keep the invite email template's `{{ .ConfirmationURL }}` link.
- Configure Supabase Auth email delivery / production SMTP. Without functioning email delivery,
  invitations cannot be reported as sent. See the [Supabase invitation documentation](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
- Set `VITE_API_BASE_URL` to the Flask service when frontend and backend use different hosts;
  include the frontend origin in backend `ALLOWED_ORIGINS`.

A success message means Supabase accepted the email send, not that the recipient has read it.
If delivery times out, check **User accounts** and Supabase Auth/email logs before retrying. A failed
send does not display a success notice or clear the form. Unused reservations expire after one hour;
this is separate from Supabase's email-link expiry. A retry replaces an unused reservation. Account
creation consumes the reservation once, and the email confirmation status is shown in the directory.

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
3. Active Admin adds a Doctor, who receives an invitation email, sets a password, and signs in.
   Verify that Patient/Doctor and suspended Admin sessions cannot send invitations, including old tokens.
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

- The browser never holds a service-role key. Doctor invitations use the authenticated Flask endpoint;
  a guarded database reservation and Auth trigger verify the inviting administrator before creation.
- `profiles` and clinical tables remain unreadable/unwritable for other users through direct PostgREST
  calls; the Admin screens use guarded `SECURITY DEFINER` functions instead of broad policies.
- Identity numbers (`nric_passport_no`) are deliberately excluded from Admin list responses.
- Admin screens manage people and access, not clinical measurements. The existing clinical reporting
  surfaces are unchanged.
