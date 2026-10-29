import React, { useEffect, useState } from 'react';
import { listPredictionResults, type SavedPrediction } from '../lib/predictionResults';

export function LabResultsView({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<SavedPrediction[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    listPredictionResults(patientId, offset).then(data => { if (!cancelled) setRows(data); })
      .catch(failure => { if (!cancelled) { setRows([]); setError(failure.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, offset, retry]);
  return <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Lab results</h1><p className="mt-2 text-sm text-slate-500">Saved prediction history · {patientId}</p></div><button type="button" onClick={() => setRetry(v => v + 1)} className="text-sm font-semibold text-teal-700">Refresh</button></div>
    <p className="text-xs text-slate-500">These are saved model predictions and simulations, not measured laboratory tests. Each snapshot keeps its original events and model version.</p>
    {loading ? <p role="status">Loading saved results…</p> : error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No saved predictions. Use “Save to lab results” after running a prediction.</p> : rows.map(row => {
      const output = row.scenario || row.output;
      return <article key={row.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><time dateTime={row.created_at} className="font-semibold">{new Date(row.created_at).toLocaleString()}</time><span className="text-xs text-slate-500">{row.engine === 'physiology' ? 'Exploratory physiology simulation' : 'GRU prediction'} · {row.output.horizon_hours}h</span></div>
        <p className="whitespace-pre-wrap text-sm">{row.event_summary}</p>
        <p className="text-sm">Baseline end: {output.baseline_end.toFixed(1)} mg/dL · Scenario end: {output.scenario_end.toFixed(1)} mg/dL</p>
        <p className="text-xs text-slate-500">Forecast origin: {row.output.forecast_start} · Source: {row.output.source}</p>
        <details><summary className="cursor-pointer text-sm font-semibold text-teal-700">View saved result</summary><p className="my-3 break-all text-xs text-slate-500">Model SHA-256: {row.model_sha256}</p><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="py-2">Forecast time</th><th>Baseline (mg/dL)</th><th>Scenario (mg/dL)</th></tr></thead><tbody>{output.baseline.map((point, index) => <tr key={point.timestamp} className="border-t border-slate-100"><td className="py-2">{point.timestamp}</td><td>{point.value.toFixed(1)}</td><td>{output.scenario[index]?.value.toFixed(1) ?? '—'}</td></tr>)}</tbody></table></div></details>
      </article>;
    })}
    <div className="flex gap-4 text-sm"><button type="button" disabled={loading || offset === 0} onClick={() => setOffset(v => Math.max(0, v - 20))} className="disabled:opacity-40">Previous</button><button type="button" disabled={loading || rows.length < 20} onClick={() => setOffset(v => v + 20)} className="disabled:opacity-40">Next</button></div>
  </section>;
}
