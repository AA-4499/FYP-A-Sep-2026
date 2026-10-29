import React, { useEffect, useState } from 'react';

const key = 'diatwin-font-size';
const sizes = [16, 18, 20, 22];
export function applySavedFontSize() {
  try {
    const value = Number(localStorage.getItem(key));
    document.documentElement.style.fontSize = `${sizes.includes(value) ? value : 16}px`;
  } catch { /* Keep the default when browser storage is unavailable. */ }
}

export function FontSizeSettings() {
  const [size, setSize] = useState(() => parseFloat(document.documentElement.style.fontSize) || 16);
  const [notice, setNotice] = useState('');
  useEffect(() => { document.documentElement.style.fontSize = `${size}px`; }, [size]);
  return <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="text-lg font-bold">Text size</h2><p className="mt-2 text-sm text-slate-500">Choose a comfortable reading size for all workspaces on this browser.</p>
    <label className="mt-4 block text-sm font-semibold">Display size<select value={size} onChange={event => {
      const value = Number(event.target.value); setSize(value);
      try { localStorage.setItem(key, String(value)); setNotice('Text size saved.'); }
      catch { setNotice('Text size changed for this session. Browser storage is unavailable.'); }
    }} className="ml-3 rounded-lg border border-slate-300 p-2">{sizes.map((value, index) => <option key={value} value={value}>{['Default', 'Large', 'Extra large', 'Largest'][index]}</option>)}</select></label>
    <p className="mt-4 text-sm">Preview: Your health records and predictions.</p>{notice && <p role="status" className="mt-2 text-xs text-teal-700">{notice}</p>}
  </section>;
}
