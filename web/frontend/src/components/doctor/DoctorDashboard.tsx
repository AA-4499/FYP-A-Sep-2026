import React, { useMemo, useState } from "react";
import { ArrowRight, Search, Users, Activity, ClipboardList, FileQuestion } from "lucide-react";
import type { Patient } from "../../types";
import { clinicalValue } from "../../lib/clinicalData";
import { dashboardDate, filterReviewPatients, glucoseOverview, reviewSignals, type ReviewFilter } from "../../lib/dashboardOverview";

const card = "rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6";

export function DoctorDashboard({ patients, onOpen }: {
  patients: Patient[]; onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<ReviewFilter>("review");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(6);
  const signals = useMemo(() => patients.map(reviewSignals), [patients]);
  const visible = useMemo(() => filterReviewPatients(patients, filter, query), [patients, filter, query]);
  const measured = patients.filter(p => Number.isFinite(p.hba1c));
  const groups = [
    { label: "Below 7%", count: measured.filter(p => p.hba1c < 7).length, color: "bg-teal-500" },
    { label: "7 to <8.5%", count: measured.filter(p => p.hba1c >= 7 && p.hba1c < 8.5).length, color: "bg-amber-400" },
    { label: "8.5% or above", count: measured.filter(p => p.hba1c >= 8.5).length, color: "bg-rose-400" },
  ];
  const select = (value: ReviewFilter) => { setFilter(value); setLimit(6); };
  const stats = [
    { label: "Patients", value: patients.length, icon: Users, color: "bg-teal-50 text-teal-700" },
    { label: "Low glucose recorded", value: signals.filter(s => s.low).length, icon: Activity, color: "bg-white/80 text-rose-700" },
    { label: "HbA1c ≥8.5%", value: signals.filter(s => s.hba1c).length, icon: ClipboardList, color: "bg-white/80 text-amber-700" },
    { label: "Missing HbA1c", value: signals.filter(s => s.missing).length, icon: FileQuestion, color: "bg-white/80 text-sky-700" },
  ];
  return <div className="space-y-6" data-testid="doctor-dashboard">
    <section aria-labelledby="care-overview-heading" data-testid="care-overview-summary" className="space-y-6 rounded-3xl border border-teal-900 bg-teal-950 p-5 sm:p-6">
      <div><h1 id="care-overview-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Care overview</h1><p className="mt-2 text-sm text-teal-100/80">Review your patients and open the records that need a closer look.</p></div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border border-white bg-white p-4 sm:p-5">
          <dt className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-600">{label}</span><span className={`hidden rounded-lg p-2 sm:block ${color}`}><Icon size={17} /></span></dt>
          <dd className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</dd>
        </div>)}
      </dl>
    </section>
    <section className={card} aria-labelledby="review-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="review-heading" className="text-lg font-semibold">Patient review</h2><p className="mt-1 text-sm text-slate-500">{signals.filter(s => s.review).length} {signals.filter(s => s.review).length === 1 ? "record" : "records"} with review signals</p></div>
        <label className="relative w-full sm:w-64"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search dashboard patients" value={query} onChange={e => { setQuery(e.target.value); setLimit(6); }} placeholder="Search patients" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-teal-600" /></label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Patient review filters">
        {([ ["review", "Review signals"], ["all", "All patients"], ["low", "Low glucose"], ["hba1c", "Raised HbA1c"], ["missing", "Missing results"] ] as const).map(([value, label]) => <button key={value} onClick={() => select(value)} aria-pressed={filter === value} className={`rounded-lg px-3 py-2 text-sm font-medium ${filter === value ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50"}`}>{label}</button>)}
      </div>
      <div className="mt-4 divide-y divide-slate-100" data-testid="dashboard-review-list">
        {visible.slice(0, limit).map(patient => {
          const signal = reviewSignals(patient), glucose = glucoseOverview(patient.cgmReadings);
          return <button key={patient.id} onClick={() => onOpen(patient.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 py-4 text-left hover:bg-slate-50/70 sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto]" aria-label={`Open ${patient.name}`}>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{patient.name}</p><div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">{signal.low && <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">CGM below 70 mg/dL</span>}{signal.hba1c && <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">HbA1c ≥8.5%</span>}{signal.missing && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-500">HbA1c missing</span>}{!signal.low && !signal.hba1c && !signal.missing && <span className="text-slate-500">No selected review signals</span>}</div></div>
            <div className="hidden text-sm sm:block"><p className="text-xs text-slate-500">HbA1c</p><p className="mt-1 font-semibold">{clinicalValue(patient.hba1c, "%")}</p></div>
            <div className="hidden text-sm sm:block"><p className="text-xs text-slate-500">CGM in range</p><p className="mt-1 font-semibold">{clinicalValue(glucose.inRange, "%")}</p></div>
            <div className="flex items-center gap-3"><span className="hidden text-xs text-slate-500 xl:block">{glucose.latest ? dashboardDate(glucose.latest.timestamp) : "No CGM"}</span><ArrowRight size={17} className="text-slate-400" /></div>
          </button>;
        })}
        {!visible.length && <div className="py-10 text-center"><p className="font-medium text-slate-700">No matching records</p><p className="mt-2 text-sm text-slate-500">Try another filter or search.</p></div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500"><span>{Math.min(limit, visible.length)} of {visible.length} records</span>{visible.length > limit && <button className="font-semibold text-teal-700" onClick={() => setLimit(limit + 6)}>Show more patients</button>}</div>
      <p className="mt-4 text-xs leading-relaxed text-slate-400">Historical review filters: any CGM reading below 70 mg/dL or HbA1c ≥8.5%. These are record flags, not live alerts or individual treatment targets.</p>
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={card}><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">HbA1c across your cohort</h2><span className="text-sm text-slate-500">{measured.length} measured</span></div>
        {measured.length ? <><div className="my-6 flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={groups.map(g => `${g.label}: ${g.count} patients`).join(", ")}>{groups.map(g => <div key={g.label} className={g.color} style={{ width: `${100 * g.count / measured.length}%` }} />)}</div><div className="grid grid-cols-3 gap-3">{groups.map(g => <div key={g.label}><div className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 shrink-0 rounded-full ${g.color}`} />{g.label}</div><p className="mt-2 text-xl font-semibold">{g.count}</p></div>)}</div></> : <p className="py-8 text-sm text-slate-500">No HbA1c results available.</p>}
      </section>
      <section className={card}><h2 className="text-base font-semibold">Record completeness</h2><div className="mt-5 space-y-4">{[
        ["HbA1c", measured.length], ["Fasting glucose", patients.filter(p => Number.isFinite(p.fastingGlucose)).length], ["CGM readings", patients.filter(p => validCGM(p)).length],
      ].map(([label, count]) => <div key={label}><div className="mb-2 flex justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-medium">{count} / {patients.length}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${patients.length ? 100 * Number(count) / patients.length : 0}%` }} /></div></div>)}</div></section>
    </div>
  </div>;
}

function validCGM(patient: Patient) { return Boolean(glucoseOverview(patient.cgmReadings).latest); }
