import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { trainingRequest, retrainingReadiness, type TrainingJob, type RetrainingReadiness } from '../../lib/modelApi';
import { decoderManifest } from '../../lib/conditionalPrediction';

export function AdminRetrainingView() {
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [readiness, setReadiness] = useState<RetrainingReadiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [dataError, setDataError] = useState('');
  const refreshData = useCallback(async (force = false) => {
    setChecking(true);
    try { setReadiness(await retrainingReadiness(force)); setDataError(''); }
    catch (failure) { setDataError(failure instanceof Error ? failure.message : 'New-data statistics are unavailable.'); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    let disposed = false;
    const poll = () => trainingRequest('GET').then(value => {
      if (!disposed) { setJob(value); setError(''); }
    }).catch(failure => { if (!disposed) setError(failure.message); });
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  useEffect(() => { void refreshData(); }, [refreshData, job?.status]);
  const start = async () => {
    setBusy(true); setError('');
    try { setJob(await trainingRequest('POST')); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to start training.'); }
    finally { setBusy(false); }
  };
  const storage = job?.storage ?? readiness?.storage;
  const intervalBlocked = !!readiness?.baseline_available && readiness.days_since_success !== null && readiness.days_since_success < readiness.policy.minimum_interval_days;
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
    <div><h1 className="text-2xl font-bold">Prediction models</h1><p className="mt-2 text-sm text-slate-600">The default glucose workspace uses the retrained v3 conditional models below. Their versions change through offline training, validation, export and website deployment.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(decoderManifest).map(([cohort, entry]) => <article key={cohort} className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm"><h2 className="font-semibold">{entry.name}</h2><p>{entry.version} · 15 / 30 / 60 / 240 minutes</p><p className="break-all text-xs text-slate-500">Checkpoint: {entry.checkpoint_sha256}</p></article>)}</div>
    <h2 className="font-semibold">Previous GRU online model</h2><p className="text-sm text-slate-600">Manual retraining uses valid Supabase CGM records. It updates the previous online GRU only; the browser v3 models and historical saved results keep their own versions.</p>
    <section aria-label="New training data" className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">New-data accumulation</h3><button type="button" disabled={checking} onClick={() => void refreshData(true)} className="font-semibold text-indigo-700 disabled:opacity-50">{checking ? 'Checking data…' : 'Refresh data count'}</button></div>
      {dataError && <p role="alert" className="text-rose-700">{dataError}</p>}
      {readiness && <>
        <p>{readiness.baseline_available ? `${readiness.new_observations.toLocaleString()} new valid observations / ${readiness.threshold.toLocaleString()} required` : 'No successful-training baseline yet. The first accepted manual run establishes it.'}</p>
        <progress className="h-3 w-full accent-indigo-600" aria-label="New valid observations toward retraining threshold" max={1} value={readiness.progress_fraction} />
        <p>{readiness.new_data_timelines} timelines with new data / {readiness.policy.minimum_new_timelines} required · minimum interval {readiness.policy.minimum_interval_days} days</p>
        <p className="text-xs text-slate-500">{readiness.additional_timelines} additional eligible visits · {readiness.additional_patients} additional patients since the baseline</p>
        {readiness.last_success_at && <p>Last successful activation: {new Date(readiness.last_success_at).toLocaleString()}</p>}
        <p>{readiness.current.valid_observations.toLocaleString()} eligible observations · {readiness.current.complete_timelines} trainable timelines · {readiness.current.patients} patients</p>
        <p className="text-xs text-slate-500">Excluded: {readiness.quality.invalid_rows} invalid rows, {readiness.quality.duplicate_rows} repeated rows, {readiness.quality.conflicting_duplicate_rows} conflicting duplicate rows, {readiness.quality.short_segment_rows} rows in short segments. Corrections: {readiness.changed_observations}; removed since baseline: {readiness.removed_observations}.</p>
        {readiness.recommended ? <p role="status" className="font-semibold text-teal-800">Retraining recommended. Review the new data, then start manually.</p> : <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">{readiness.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
        <p className="text-xs text-slate-500">Approved policy {readiness.policy.version}. Counts refresh on request and are cached for up to five minutes. These conditions recommend training; they never launch it automatically.</p>
      </>}
    </section>
    {storage?.error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{storage.error}</p>}
    {storage?.writable && <p className="text-sm text-slate-600">Model storage is writable. {storage.initialized ? 'An immutable active release is available.' : 'Initialize the persistent store before the first training run.'}</p>}
    <button type="button" disabled={busy || !job || job.status === 'running' || !storage?.writable || intervalBlocked} onClick={() => void start()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} className={job?.status === 'running' ? 'animate-spin' : ''} />{job?.status === 'running' ? 'Training in progress…' : 'Retrain model'}</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {job && <div role="status" className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
      <p className="font-semibold">Status: {job.status}</p>
      {job.started_at && <p>Started: {new Date(job.started_at).toLocaleString()}</p>}
      {job.finished_at && <p>Finished: {new Date(job.finished_at).toLocaleString()}</p>}
      {job.rows !== undefined && <p>{job.rows.toLocaleString()} valid observations · {job.records} timelines</p>}
      {job.metrics && <p>Candidate MAE: {job.metrics.mae_mg_dl.toFixed(2)} mg/dL · RMSE: {job.metrics.rmse_mg_dl.toFixed(2)} mg/dL</p>}
      {job.comparison?.active && <div className="overflow-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">Same held-out data · {job.comparison.evaluation_windows} windows</caption><thead><tr><th>Metric</th><th>Active model</th><th>Candidate</th></tr></thead><tbody>{(['mae_mg_dl', 'rmse_mg_dl'] as const).map(metric => <tr key={metric}><th>{metric === 'mae_mg_dl' ? 'MAE (mg/dL)' : 'RMSE (mg/dL)'}</th><td>{job.comparison!.active[metric].toFixed(2)}</td><td>{job.comparison!.candidate[metric].toFixed(2)}</td></tr>)}</tbody></table><p className="mt-2">Quality gate: {job.comparison.accepted ? 'passed' : 'rejected'} · neither metric may worsen.</p><p className="mt-2 text-slate-500">{job.comparison.scope}</p></div>}
      {job.model_sha256 && <p className="break-all text-xs">Activated model: {job.model_sha256}</p>}
      {storage?.active_model_sha256 && <p className="break-all text-xs">Current model: {storage.active_model_sha256}</p>}
      {job.error && <p role="alert" className="text-rose-700">{job.error}</p>}
    </div>}
    <p className="text-xs text-slate-500">Failed or rejected training preserves both the active model and its data baseline. Accepted releases commit the checkpoint and baseline together. Keep the configured disk mounted across restarts and redeployments.</p>
  </section>;
}
