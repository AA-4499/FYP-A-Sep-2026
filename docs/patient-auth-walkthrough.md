# Patient registration and personal dashboard

This milestone connects Patient signup, email confirmation/resend, email/password login,
session restoration, local sign-out, and password recovery to Supabase. Doctor applications
and live Admin approvals remain a separate next step. The old `AuthView.tsx` is an unused
design prototype; the active form is `AccountAuthView.tsx`.

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

Do not share secret/service-role keys or put them in `VITE_` variables. The app's existing
publishable key is used for signup and sign-in. The SQL file has not been applied remotely
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
   the same user ID has role `patient` and a null `patient_id`.
   Confirm `nric_passport_no` matches the synthetic value you entered.
5. Open the confirmation link while the local app is running. The app should show
   **Patient dashboard** with your name, email, and personal navigation. New accounts see
   **Your dashboard is ready**, empty health measurements, and a care-team linking message.
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
- Preview sample dashboards while signed out. Preview mode does not run the cohort sync.

## Current access boundary and next step

The identity number is self-reported, not proof of identity, and never assigns a medical
record or a role. This prototype passes it in Supabase signup user metadata so the
database trigger can copy it to the profile. Supabase also includes user metadata in
session JWTs: do not log/share tokens or use real identity numbers in development.
Before collecting real IDs, replace this metadata transport with a trusted server
registration flow that stores the number outside Auth metadata/JWTs. The profile column
is protected by owner-only RLS, but is not application-encrypted.

Confirmed Patient accounts now open their own dashboard, My health, and My profile.
The dashboard calls `get_my_patient_dashboard()` without accepting a patient ID from the
browser. The database uses `auth.uid()` to find the account's `profiles.patient_id` link.
It returns only that record's recorded measurements and up to 100 recent observations.
The function uses SECURITY INVOKER so table RLS still applies. Missing measurements stay
missing, with no default clinical values, sample recommendations, or calculated risk scores.
There is no patient selector, Doctor/Admin switch, or database settings menu for Patients.
The richer simulation/twin/report pages remain in the Doctor/sample workspace until
their data and authorization are ready for Patient use.

For a Patient with existing medical data, a trusted administrator must verify ownership
and set `profiles.patient_id` to the exact `patient_summary."Patient Number"` in the
Supabase Table Editor (or a future trusted server workflow). The NRIC/passport number
does not automatically authorize a link. New Patients can use their dashboard with a
null link. Existing sample cohort records must not be arbitrarily assigned to real people.

After applying the dashboard SQL, test with two separate test accounts and different
authorized test records: each dashboard must show only its linked record. With the
Patient's JWT, direct REST reads of the other record must return no rows; attempts to
change `profiles.patient_id` or write clinical data must fail or affect zero rows. A newly
registered unlinked account must see no clinical data. Also test logout and switching
accounts in the same browser. These deployed RLS checks have not been run by the agent;
frontend tests use mocked responses and cannot establish database isolation by themselves.

Only trusted `app_metadata` can route a signed-in account to Doctor or Admin. Editable
`user_metadata` is never used to grant those roles. An account with no assigned role has
Patient-level access; an unrecognized explicit role is blocked. Backend directory browsing
is now denied for Patient tokens. The Admin pages still operate on browser-local sample data.

## Files to learn from

- `src/lib/accountAuth.ts`: signup request, password validation, trusted-role mapping.
- `src/components/AccountAuthView.tsx`: forms, confirmation/resend, recovery, errors.
- `src/components/AuthGateway.tsx`: session verification, routing, sign-out.
- `src/components/PatientWorkspace.tsx`: personal dashboard and empty/loading/error states.
- `src/lib/patientDashboard.ts`: own-account RPC loader; no sample fallback.
- `docs/supabase_patient_registration.sql`: database profile creation and client-write restrictions.
- `docs/supabase_patient_dashboard.sql`: clinical RLS and own-account dashboard function.

Official references: [Password auth](https://supabase.com/docs/guides/auth/passwords),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Default email limitations](https://supabase.com/docs/guides/auth/auth-smtp).
