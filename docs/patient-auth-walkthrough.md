# Patient registration: first working milestone

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
   It also prevents browser clients from inserting, updating, or deleting profiles;
   future live Admin writes must go through a trusted server. Do not rerun the original
   `supabase_phase2.sql` on an existing database.
5. With default email delivery, use an email already belonging to your project's team.
   Sending to general users requires custom SMTP. Default sending limits are small;
   repeated tests and resend attempts can be rate limited.

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
2. Enter a test name, an existing team email, and matching passwords (at least 8 characters).
   No national ID or medical details are collected in this milestone.
3. Submit once. The app should show **Check your inbox**. This does not itself mean verified.
4. In Authentication → Users, confirm the user exists. In Table Editor → profiles, confirm
   the same user ID has role `patient` and a null `patient_id`.
5. Open the confirmation link while the local app is running. The app should show
   **Your Patient account is ready** with the correct email and a waiting-for-record message.
6. Refresh. The session should restore to the same account screen.
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

Patient accounts currently stay on the account-ready screen. Even a linked account does
not open the clinical dashboard in this milestone. This prevents the old default-patient
fallback from displaying an unrelated record. Next, implement the trusted patient-linking
process, enforce database row-level security on the deployed clinical tables, and connect
the exact linked record with no demo fallback. Database security on existing clinical
tables has not been changed or verified by this migration.

Only trusted `app_metadata` can route a signed-in account to Doctor or Admin. Editable
`user_metadata` is never used to grant those roles. An account with no assigned role has
Patient-level access; an unrecognized explicit role is blocked. Backend directory browsing
is now denied for Patient tokens. The Admin pages still operate on browser-local sample data.

## Files to learn from

- `src/lib/accountAuth.ts`: signup request, password validation, trusted-role mapping.
- `src/components/AccountAuthView.tsx`: forms, confirmation/resend, recovery, errors.
- `src/components/AuthGateway.tsx`: session verification, routing, account screen, sign-out.
- `docs/supabase_patient_registration.sql`: database profile creation and client-write restrictions.

Official references: [Password auth](https://supabase.com/docs/guides/auth/passwords),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Default email limitations](https://supabase.com/docs/guides/auth/auth-smtp).
