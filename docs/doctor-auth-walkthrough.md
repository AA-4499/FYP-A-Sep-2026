# Doctor registration

The active `AccountAuthView.tsx` supports **Register as a Doctor** with full name,
organisation / clinic, professional registration number, email, password and password
confirmation. Supabase sends the confirmation link. A confirmed applicant can sign in
to see the pending-approval screen and use **Check again** after approval.

Sign-in reads the current user's application through
`get_my_doctor_application_status()`. This function accepts no account identifier
and returns only the signed-in user's ID and application status. It avoids older
table policies that can prevent direct reads. While upgrading, a missing function
falls back to the existing owner-filtered table lookup.

A saved `pending` application shows the approval screen even for older accounts
whose Auth metadata still says `patient` or has no pending marker. Approved
applications also require the trusted Auth Doctor role before opening the clinical
workspace. When the lookup fails, ordinary accounts retain their verified Auth
permissions. Trusted pending/rejected markers still block access; Doctor applicants
without verified approval see a waiting screen with an error reference. Editable
signup metadata never grants a privileged role.

If every login previously showed **Your Doctor application status could not be
checked**, update the frontend and run
[supabase_doctor_application_status.sql](supabase_doctor_application_status.sql)
once in the Supabase SQL Editor. This small repair adds only the restricted lookup
function and its execute permission. It does not change tables, rows or existing
policies, and is already included in the full Doctor registration script.

If an older Doctor signup has no visible application row, the app shows **Your
Doctor application needs attention**. A project operator should check whether the
signup trigger was applied and whether the account can read its application. A
metadata-only signup does not prove that an application was saved. Use this
read-only SQL to inspect Doctor requests and their saved application status:

```sql
select u.id, u.email, p.role as profile_role,
       u.raw_app_meta_data->>'role' as auth_role,
       u.raw_app_meta_data->>'doctor_registration_status' as auth_application_status,
       a.status as application_status
from auth.users u
left join public.profiles p on p.id = u.id
left join public.doctor_applications a on a.user_id = u.id
where a.user_id is not null or u.raw_user_meta_data->>'requested_role' = 'doctor';
```

## Database setup

For your existing tables with Patient registration already configured, run these
updated files in order in the Supabase SQL Editor:

1. [supabase_patient_auto_provision.sql](supabase_patient_auto_provision.sql)
2. [supabase_doctor_registration.sql](supabase_doctor_registration.sql)

The provisioning change
prevents pending applicants from receiving Patient Numbers and medical records.
Always apply the Doctor script last: the Patient registration script replaces the
same Auth signup trigger function. These changes have not been applied remotely.

The Doctor script requires your existing `profiles` and `doctor_applications`
tables and checks the required columns before making changes. It creates no tables
or columns. It updates the registration/approval functions and access policies.

The form sends `full_name`, `registration_id` and `organisation` to Supabase Auth;
the signup trigger stores them in your existing tables. The Doctor script uses
your existing eight-column `doctor_applications` table:
the registration number goes into `registration_id`, and the clinic goes into
`organisation`. The name is stored in `profiles.full_name`. It preserves
`review_note` and `reviewed_by`, and sets `status` and `reviewed_at` on approval.
It does not add duplicate name or registration-number columns or change existing
rows. New profiles retain the database defaults for `status` (`active` in your
schema) and `department`; application approval is tracked separately.

Keep email confirmation enabled and use the existing redirect allowlist and email
configuration described in [the Patient walkthrough](patient-auth-walkthrough.md).
Existing accounts are not converted into applications; test with a new email address.

## Review and approve an application

The existing browser Admin dashboard uses sample data. Its approval buttons do not
approve live registrations. A trusted project operator can review applications in
the SQL Editor:

```sql
select a.*, p.full_name, u.email, u.email_confirmed_at
from public.doctor_applications a
join public.profiles p on p.id = a.user_id
join auth.users u on u.id = a.user_id
where a.status = 'pending'
order by a.created_at;
```

After reviewing the professional details, approve the chosen account by substituting
its `user_id` below:

```sql
select public.approve_doctor_application('APPLICANT-UUID-HERE'::uuid);
```

The function requires a confirmed email and a pending application. It atomically
sets the profile role and trusted Auth role to `doctor`, marks the application as
approved and records the review time. It is callable only by the SQL operator or a
server service role; never put a service-role key in the frontend. The applicant can
click **Check again** to refresh their token, or sign in again, to open the Doctor
workspace. Approved accounts use the project's existing Doctor access policies.

## Verification

- Register a new Doctor and confirm that the professional details appear in
  `doctor_applications.registration_id` and `organisation`, with status `pending`.
  Confirm their name is in `profiles.full_name` and `profiles.patient_id` is null.
- Confirm the email and sign in: the pending screen must appear, with no clinical data.
- Approve through the function, then use **Check again** to enter the Doctor workspace.
- Register a Patient: the Patient Number and empty medical record must still be created.

Public signup stores only a role request in editable user metadata. The database
snapshots the application and sets trusted `app_metadata.doctor_registration_status`
to `pending`; changing editable metadata cannot approve an application. Pending
accounts have a placeholder Patient profile role, but cannot access clinical data
through the frontend, backend or database policies. No fourth platform role is added.

Automated coverage runs with `npm run test:auth` and `npm run test:database` from
`web/frontend`, and `python -m unittest web/backend/tests/test_auth_roles.py` from
the repository root with backend dependencies installed.
