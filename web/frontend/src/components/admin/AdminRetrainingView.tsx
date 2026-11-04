import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { trainingRequest, type TrainingJob } from '../../lib/modelApi';
import { decoderManifest } from '../../lib/conditionalPrediction';

export function AdminRetrainingView() {
  const [job, setJob] = useState<TrainingJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const poll = () => trainingRequest('GET').then(value => {
      if (!disposed) { setJob(value); setError(''); }
    }).catch(failure => { if (!disposed) setError(failure.message); });
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  const start = async () => {
    setBusy(true); setError('');
    try { setJob(await trainingRequest('POST')); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to start training.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
    <div><h1 className="text-2xl font-bold">Prediction models</h1><p className="mt-2 text-sm text-slate-600">The default glucose workspace uses the retrained v3 conditional models below. New versions require offline training, validation, export and website deployment.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(decoderManifest).map(([cohort,entry]) => <article key={cohort} className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm"><h2 className="font-semibold">{entry.name}</h2><p>{entry.version} · 15 / 30 / 60 / 240 minutes</p><p className="break-all text-xs text-slate-500">Checkpoint: {entry.checkpoint_sha256}</p></article>)}</div>
    <h2 className="font-semibold">Previous GRU comparison model</h2><p className="text-sm text-slate-600">The queue below retrains only the previous online GRU from Supabase. It does not update either v3 conditional model or its IOB features.</p>
    <button type="button" disabled={busy || !job || job.status === 'running'} onClick={() => void start()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={16} className={job?.status === 'running' ? 'animate-spin' : ''} />{job?.status === 'running' ? 'Training in progress…' : 'Retrain model'}</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {job && <div role="status" className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
      <p className="font-semibold">Status: {job.status}</p>
      {job.started_at && <p>Started: {new Date(job.started_at).toLocaleString()}</p>}
      {job.finished_at && <p>Finished: {new Date(job.finished_at).toLocaleString()}</p>}
      {job.rows !== undefined && <p>{job.rows.toLocaleString()} readings · {job.records} patient records</p>}
      {job.metrics && <p>Held-out MAE: {job.metrics.mae_mg_dl.toFixed(2)} mg/dL · RMSE: {job.metrics.rmse_mg_dl.toFixed(2)} mg/dL</p>}
      {job.model_sha256 && <p className="break-all text-xs">Active model: {job.model_sha256}</p>}
      {job.error && <p role="alert" className="text-rose-700">{job.error}</p>}
    </div>}
    <p className="text-xs text-slate-500">You can leave this page while legacy training runs. Existing saved results keep their original model version. Only the previous GRU online service uses this queued checkpoint; browser models remain versioned website assets.</p>
  </section>;
}
