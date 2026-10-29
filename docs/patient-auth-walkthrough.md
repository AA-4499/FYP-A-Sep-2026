# Patient registration and personal dashboard

This milestone connects Patient signup, email confirmation/resend, email/password login,
explicit sign-in, local sign-out, and password recovery to Supabase. Doctor applications are
submitted from the sign-in page and approved or declined in the Admin workspace; role, suspension
and application state are read from the database after every sign-in. The old `AuthView.tsx` is an
unused design prototype; the active form is `AccountAuthView.tsx`. Admin operations are documented
in the [Admin operations runbook](admin-operations.md).

Opening or reloading the app starts at the login page. Supabase sessions are held in memory (`persistSession: false`), and `AuthGateway` ignores restored/background sign-in events until the user successfully submits this page's login form. Patient data is not loaded before that action. Current-page token refresh continues to work after sign-in. Password-recovery links open the reset form and return to login when complete; they do not open a workspace automatically.

## 1. Supabase setup (you do this once)

1. In your existing Supabase project, keep Email sign-in, signups, and Confirm email enabled.
2. Under Authentication → URL Configuration, allow `http://localhost:3000/` and
   `http://localhost:3000/**`. Keep your deployed URL as Site URL if already configured.
3. Keep the default confirmation email template with its confirmation link. The new form
   uses links, not the prototype's six-digit code. Recovery returns to `/?auth=recovery`.
4. Review and run [supabase_patient_registration.sql](supabase_patient_registration.sql)
   in the SQL Editor. It creates a profile when an Auth user is created and provisions
   missing profiles for existing users. Existing profiles remain unchanged.
   If you ran an earlier version, rerun this updated script: it adds the nullable
   `nric_passport_no` column to the existing table and updates the registration trigger.
   Existing accounts keep a blank identity number. Profile reads are now restricted to
   the account owner, including when an older policy allowed all Doctors/Admins to read them.
   It also prevents browser clients from inserting, updating, or deleting profiles;
   future live Admin writes must go through a trusted server. Do not rerun the original
   `supabase_phase2.sql` on an existing database.
5. With default email delivery, use an email already belonging to your project's team.
   Sending to general users requires custom SMTP. Default sending limits are small;
   repeated tests and resend attempts can be rate limited.
6. Run [supabase_patient_dashboard.sql](supabase_patient_dashboard.sql) after the profile
   script. It adds the dashboard function and enables row-level security on the existing
   `patient_summary` and `patient_detail` tables. Patients can read only the record linked
   by their own profile; anonymous reads and Patient clinical writes are blocked even if
   older broad policies exist. Trusted Doctor/Admin accounts retain cohort read access.
   It does not create clinical tables, assign records, or change existing medical data.
7. Run [supabase_patient_auto_provision.sql](supabase_patient_auto_provision.sql).
   This adds automatic Patient Numbers such as `PT-000001`. Registration creates a
   profile and an empty row in `patient_summary`, then links them in the same transaction.
   It also provisions existing unlinked Patient accounts, so your current test account
   does not need to register again. Existing links are preserved. Doctor/Admin accounts
   with trusted roles do not receive Patient records. You can rerun the script safely.
   No `patient_detail` observations are created until actual readings are recorded.
   This script uses existing tables and adds a sequence, trigger, and ownership constraints.
   If your imported schema requires clinical values or has duplicate/broken links, it
   stops with an error instead of inventing measurements or reassigning records.
8. Run [supabase_admin_workspace.sql](supabase_admin_workspace.sql). This adds the Admin
   workspace schema and functions, Doctor applications, account status/suspension, the audit
   log, and enforced clinical RLS (Doctors see only assigned patients; suspended accounts see
   nothing). It is idempotent. Apply it before deploying the frontend build that uses it.
9. Bootstrap the first administrator by promoting an existing auth account. The exact SQL and
   verification steps are in the [Admin operations runbook](admin-operations.md#2-bootstrap-the-first-administrator-required-once).
   Admin accounts are never created from the Admin UI.

Do not share secret/service-role keys or put them in `VITE_` variables. The app's existing
publishable key is used for signup and sign-in. The SQL files have not been applied remotely
by the coding agent.

## 2. Run the frontend

From the repository root:

```powershell
cd web/frontend
npm run dev
```

Use the Local URL printed by Vite (normally `http://localhost:3000`). If Vite chooses a
different port, add that exact local origin to the Supabase redirect allowlist.

## 3. Test one Patient account

1. Choose **New here? Create a Patient account**.
2. Enter a test name, a synthetic **NRIC / Passport No.**, an existing team email,
   and matching passwords (at least 8 characters). The identity number is required;
   leading zeros, passport letters, and NRIC hyphens are retained. Use fictional IDs in development.
3. Submit once. The app should show **Check your inbox**. This does not itself mean verified.
4. In Authentication → Users, confirm the user exists. In Table Editor → profiles, confirm
   the same user ID has role `patient` and an automatically assigned `patient_id`, such as
   `PT-000001`. In `patient_summary`, check that `Patient Number` matches it and clinical
   measurements are null. The number is assigned by the database, never by the form.
   Confirm `nric_passport_no` matches the synthetic value you entered.
5. Open the confirmation link while the local app is running. The app should show
   the existing Patient Home dashboard with your name, Patient Number, and personal
   navigation. New records show empty health measurements until the care team adds data.
6. Refresh. The session should restore to your personal dashboard.
7. Click **Sign out**. You should return to the sign-in form. Refresh to confirm it stays signed out.
8. Sign in again with the same credentials. Wrong passwords should show an error.

If that email already has an account, use sign-in or password recovery. Supabase can hide
whether an address is registered; the signup confirmation message intentionally does not
claim a new account definitely exists.

## 4. Additional checks

- Try different password/confirmation values: registration must fail before an API request.
- Before confirming email, try signing in: it should remain blocked.
- Use **Need another confirmation email?** for resend. Requests are locally spaced by
  at least one minute and remain subject to Supabase's stricter email limits.
- Use **Forgot password?**, follow the email link, set a new matching password, and sign in.
- Expired or invalid email links should display an error instead of granting access.
- Use **Doctor? Apply to join your care workspace** with a second team email: after confirming
  the email, signing in shows the "Doctor application under review" screen. Approve the
  application in the Admin workspace, sign out/in as the Doctor, and confirm the Doctor
  workspace opens. A declined application shows the administrator's reason.
- Preview sample dashboards while signed out. Preview mode does not run the cohort sync.

## Current access boundary and next step

The identity number is self-reported, not proof of identity, and never assigns a medical
record or a role. This prototype passes it in Supabase signup user metadata so the
database trigger can copy it to the profile. Supabase also includes user metadata in
session JWTs: do not log/share tokens or use real identity numbers in development.
Before collecting real IDs, replace this metadata transport with a trusted server
registration flow that stores the number outside Auth metadata/JWTs. The profile column
is protected by owner-only RLS, but is not application-encrypted.

Confirmed Patient accounts now open the existing Patient Home layout: the four metrics,
CGM waveform, risk factors, what-if controls, and health summary. The original sidebar
includes Home, My profile, My health, My digital twin, My recommendations, and Reports.
`My digital twin` opens the predictive GRU simulation (forecast and Physiology lab). The
header identifies the account as Patient and provides sign-out; care-team, Admin, cohort
search, and database settings controls are absent.
The dashboard calls `get_my_patient_dashboard()` without accepting a patient ID from the
browser. The database uses `auth.uid()` to find the account's `profiles.patient_id` link.
It returns only that record's recorded measurements and up to 100 recent observations.
The function uses SECURITY INVOKER so table RLS still applies. Missing measurements stay
missing, with no default clinical values, sample recommendations, or calculated risk scores.
There is no patient selector, Doctor/Admin switch, or database settings menu for Patients.
The shared Home component renders unavailable measurements as dashes and disables
what-if controls when no risk assessment exists. HbA1c and fasting glucose are converted
from their declared database units for the existing display. The CGM graph and time-in-range
summary use valid dated readings from the latest 100 observations, not a claimed 14-day feed.
`My digital twin` opens the browser GRU forecast and physiology what-if views for the linked
record. Reports displays recorded measurements, not a fabricated clinician report.
Recommendations remain empty until the care-team publishing integration is available.

New Patients receive a new record automatically. The database's profile trigger assigns
`profiles.patient_id` to its new `patient_summary."Patient Number"`. A unique ownership
index prevents two profiles sharing one number; a foreign key prevents dangling links.
The number is shown in the dashboard header and My profile. Sequence gaps after failed
registrations are normal. Email confirmation is still required before dashboard access.
The NRIC/passport number does not select or authorize an existing record. Importing or
merging existing clinic records into a new account requires a separate verified workflow.

After applying the dashboard SQL, test with two separate test accounts and different
authorized test records: each dashboard must show only its linked record. With the
Patient's JWT, direct REST reads of the other record must return no rows; attempts to
change `profiles.patient_id` or write clinical data must fail or affect zero rows. A newly
registered account must see its own empty record and no other clinical data. Also test logout and switching
accounts in the same browser. `npm run test:database` runs the patient SQL migrations in an
isolated PGlite PostgreSQL database with synthetic Auth/clinical schemas, and
`npm run test:admin-sql` runs the admin migration and RPC contract the same way (approval,
assignment, suspension, RLS scoping, audit, idempotent rerun). This is a
development-only dependency and is not imported by the app. These local tests do not
replace checking your deployed Supabase schema; apply the SQL migrations yourself and verify
with the checklist in the [Admin operations runbook](admin-operations.md#7-verification-checklist).

Only the database's `profiles.role` / `profiles.status` (read through `get_my_access_state()`)
and trusted `app_metadata` route a signed-in account to Patient, Doctor or Admin. Editable
`user_metadata` is never used to grant those roles. Suspended accounts are blocked before any
workspace opens, and pending Doctor applications see a review-status screen instead of a
workspace. Backend directory browsing is denied for Patient tokens. Admin changes are made
through guarded database functions and recorded in `admin_audit_logs`; see the
[Admin operations runbook](admin-operations.md).

## Files to learn from

- `src/lib/accountAuth.ts`: signup request, password validation, trusted-role mapping.
- `src/components/AccountAuthView.tsx`: forms, confirmation/resend, recovery, errors.
- `src/components/AuthGateway.tsx`: session verification, routing, sign-out.
- `src/components/PatientWorkspace.tsx`: authenticated Patient shell and empty/loading/error states.
- `src/components/DashboardView.tsx`: shared Home layout with safe missing-data display.
- `src/lib/patientDashboard.ts`: own-account RPC loader; no sample fallback.
- `src/lib/adminApi.ts`: guarded Admin RPC client and error mapping.
- `src/components/admin/AdminWorkspace.tsx`: real Admin shell (overview, users, approvals, assignments, activity).
- `docs/supabase_patient_registration.sql`: database profile creation and client-write restrictions.
- `docs/supabase_patient_dashboard.sql`: clinical RLS and own-account dashboard function.
- `docs/supabase_patient_auto_provision.sql`: automatic Patient Number, empty record, and account link.
- `docs/supabase_admin_workspace.sql`: Admin RPCs, Doctor applications, account status, audit, and enforced RLS.
- `docs/admin-operations.md`: migration order, first-admin bootstrap, verification and rollback.

Official references: [Password auth](https://supabase.com/docs/guides/auth/passwords),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Default email limitations](https://supabase.com/docs/guides/auth/auth-smtp).
