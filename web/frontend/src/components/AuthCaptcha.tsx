import { useEffect, useRef, useState } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY?.trim() || '';

/** Tokens belong to one form and one submission; never persist them. */
export function useAuthCaptcha(flow: string) {
  const [response, setResponse] = useState({ flow, token: '' });
  const [attempt, setAttempt] = useState(0);
  const token = response.flow === flow ? response.token : '';
  useEffect(() => { setResponse({ flow, token: '' }); }, [flow]);
  return {
    enabled: Boolean(siteKey),
    token,
    widgetKey: `${flow}:${attempt}`,
    verify: (value: string) => setResponse({ flow, token: value }),
    reset: () => { setResponse({ flow, token: '' }); setAttempt((value) => value + 1); },
  };
}

export function AuthCaptcha({ onVerify }: { onVerify: (token: string) => void }) {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState<'normal' | 'compact'>('normal');
  const containerRef = useRef<HTMLDivElement>(null);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    // Use the horizontal widget wherever it fits, including within narrow cards.
    const observer = new ResizeObserver(([entry]) => {
      setSize(entry.contentRect.width >= 304 ? 'normal' : 'compact');
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // Changing the native widget size replaces its challenge.
    onVerifyRef.current('');
  }, [size]);
  if (!siteKey) return null;
  const expire = () => {
    onVerify('');
    setError('Verification expired. Please complete the security check again.');
  };
  return <div className="space-y-2 py-1" aria-label="Security verification">
    <div ref={containerRef} className="flex w-full justify-center">
    <HCaptcha
      key={attempt}
      sitekey={siteKey}
      size={size}
      reCaptchaCompat={false}
      onVerify={(token) => { setError(''); onVerify(token); }}
      onExpire={expire}
      onChalExpired={expire}
      onError={() => { onVerify(''); setError('The security check could not load or complete. Check your connection and try again.'); }}
    />
    </div>
    {error && <div role="alert" className="text-xs text-rose-700">
      <p>{error}</p>
      <button type="button" className="mt-2 font-semibold text-blue-600" onClick={() => {
        onVerify(''); setError(''); setAttempt((value) => value + 1);
      }}>Retry security check</button>
    </div>}
  </div>;
}
