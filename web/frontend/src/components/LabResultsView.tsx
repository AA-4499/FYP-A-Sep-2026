import React, { useEffect, useState } from 'react';
import { listPredictionResults, type SavedPrediction } from '../lib/predictionResults';
import type { Patient } from '../types';
import { clinicalValue } from '../lib/clinicalData';
import { labGroups, laboratoryHighlights, predictionHighlights } from '../lib/resultHighlights';
import { PredictionChart } from './PredictionChart';

export function LabResultsView({ patient }: { patient: Patient }) {
  const patientId = patient.id;
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
  return <div className="space-y-6"><section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
    <div><h1 className="text-2xl font-bold">Lab results</h1><p className="mt-2 text-sm text-slate-500">Recorded measurements and written highlights for {patientId}.</p></div>
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-5"><h2 className="font-semibold text-teal-950">Key recorded findings</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{laboratoryHighlights(patient).map(line => <li key={line}>{line}</li>)}</ul></div>
    <details><summary className="cursor-pointer text-sm font-semibold text-teal-700">All laboratory measurements by category</summary><div className="mt-4 grid gap-4 md:grid-cols-2">{labGroups.map(group => <section key={group.title} className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold">{group.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{group.purpose}</p><dl className="mt-3 divide-y divide-slate-100">{group.tests.map(([label,key,unit]) => <div key={key} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><dt className="text-slate-600">{label}</dt><dd className="font-medium">{clinicalValue(patient.recordedFields?.[key], unit)}</dd></div>)}</dl></section>)}</div></details>
  </section><section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">Saved prediction highlights</h2><p className="mt-2 text-sm text-slate-500">Saved prediction history ({patientId})</p></div><button type="button" onClick={() => setRetry(v => v + 1)} className="text-sm font-semibold text-teal-700 hover:text-teal-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 active:scale-95 disabled:opacity-50">Refresh</button></div>
    <p className="text-xs text-slate-500">These are saved model predictions and simulations, not measured laboratory tests. Each snapshot keeps its original events and model version.</p>
    {loading ? <p role="status">Loading saved results…</p> : error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No saved predictions. Use “Save to lab results” after running a prediction.</p> : rows.map(row => {
      const output = row.scenario || row.output;
      return <article key={row.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-2"><time dateTime={row.created_at} className="font-semibold">{new Date(row.created_at).toLocaleString()}</time><span className="text-xs text-slate-500">{row.engine === 'physiology' ? 'Exploratory physiology simulation' : row.output.model_family === 'conditional-v3' ? 'Conditional GRU v3' : 'Previous GRU prediction'} ({row.output.horizon_hours}h{row.output.model_version ? `, ${row.output.model_version}` : ''})</span></div>
        <p className="whitespace-pre-wrap text-sm">{row.event_summary}</p>
        <div className="rounded-xl bg-slate-50 p-4"><h2 className="text-sm font-semibold">Prediction highlights</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">{predictionHighlights({ ...row.output, ...output }, row.engine).map(line => <li key={line}>{line}</li>)}</ul></div>
        <details><summary className="cursor-pointer text-sm font-semibold text-teal-700">Show prediction chart</summary><PredictionChart clockLabel={row.output.model_family === 'conditional-v3' ? 'source clock' : 'UTC'} loading={false} series={[{key:'baseline',label:'Baseline plan',color:'#64748b',points:output.baseline},{key:'scenario',label:'Changed plan',color:'#0f766e',points:output.scenario}]} /></details>
        <p className="text-xs text-slate-500">Forecast origin: {row.output.forecast_start}, Source: {row.output.source}</p>
        <details><summary className="cursor-pointer text-sm font-semibold text-teal-700">View saved result</summary><p className="my-3 break-all text-xs text-slate-500">Model SHA-256: {row.model_sha256}</p><div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="py-2">Forecast time</th><th>Baseline (mg/dL)</th><th>Scenario (mg/dL)</th></tr></thead><tbody>{output.baseline.map((point, index) => <tr key={point.timestamp} className="border-t border-slate-100"><td className="py-2">{point.timestamp}</td><td>{point.value.toFixed(1)}</td><td>{output.scenario[index]?.value.toFixed(1) ?? '—'}</td></tr>)}</tbody></table></div></details>
      </article>;
    })}
    <div className="flex gap-4 text-sm"><button type="button" disabled={loading || offset === 0} onClick={() => setOffset(v => Math.max(0, v - 20))} className="disabled:opacity-40">Previous</button><button type="button" disabled={loading || rows.length < 20} onClick={() => setOffset(v => v + 20)} className="disabled:opacity-40">Next</button></div>
  </section></div>;
}
