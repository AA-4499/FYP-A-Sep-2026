// This public site key is already documented in web/frontend/.env.example.
// It belongs only to the application's default Supabase project. A custom
// project must supply its own matching key; provider secrets never go here.
export const defaultAuthProject = 'https://dgtaujhgwxmoghqdqkti.supabase.co';
export const defaultAuthCaptchaSiteKey = 'e3980150-1606-42a2-9cdc-d554494a3e58';

export function resolveAuthCaptchaSiteKey(configuredKey: string | undefined, supabaseUrl: string): string {
  const explicit = configuredKey?.trim();
  if (explicit) return explicit;
  try {
    const url = new URL(supabaseUrl);
    return url.origin === defaultAuthProject && !url.username && !url.password
      ? defaultAuthCaptchaSiteKey : '';
  } catch { return ''; }
}
