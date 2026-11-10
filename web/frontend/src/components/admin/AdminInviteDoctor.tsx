import React, { useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { inviteDoctor, type DoctorInvitationInput } from '../../lib/doctorInvitations';
import type { AdminMutation } from './AdminPages';
import { BusyButton, cardClass, ErrorBanner, fieldClass, PageHeading } from './AdminUI';

const empty: DoctorInvitationInput = { full_name: '', email: '', organisation: '', department: '', registration_id: '' };
const fields = [
  ['full_name', 'Full name', 120], ['email', 'Email address', 254],
  ['organisation', 'Organisation / clinic', 160], ['department', 'Department / care group', 160],
  ['registration_id', 'Professional registration number', 120],
] as const;

export function AdminInviteDoctor({ mutate }: { mutate: AdminMutation }) {
  const [details, setDetails] = useState<DoctorInvitationInput>({ ...empty });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const failure = await mutate(async () => {
        const result = await inviteDoctor(details);
        return `Invitation email sent to ${result.email}. The doctor can open the link to choose a password.`;
      });
      setError(failure);
      if (!failure) setDetails({ ...empty });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return <div className="space-y-6">
    <PageHeading eyebrow="Care team" title="Add a doctor" description="Enter the doctor's information. We will email an invitation link so they can choose their own password and sign in." />
    <form onSubmit={submit} className={`${cardClass} max-w-2xl p-6 sm:p-8`}>
      <p className="mb-6 text-sm text-slate-500">Only an active administrator can add doctors. All fields are required.</p>
      {error && <div className="mb-5"><ErrorBanner message={error} /></div>}
      <fieldset disabled={busy} className="space-y-5">
        {fields.map(([key, label, limit]) => <label key={key} className="block text-xs font-semibold text-slate-600">
          {label}<input required type={key === 'email' ? 'email' : 'text'} maxLength={limit}
            autoComplete={key === 'email' ? 'email' : key === 'full_name' ? 'name' : 'off'}
            value={details[key]} onChange={(event) => setDetails({ ...details, [key]: event.target.value })}
            className={`${fieldClass} mt-2`} />
        </label>)}
        <BusyButton type="submit" busy={busy}><Mail className="h-4 w-4" />{busy ? 'Sending invitation…' : 'Send invitation'}</BusyButton>
      </fieldset>
    </form>
  </div>;
}
