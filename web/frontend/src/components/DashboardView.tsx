import React, { useMemo, useState } from "react";
import { Activity, ArrowRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Patient, NavigationModule } from "../types";
import type { ClinicalRecommendation } from "../data/knowledgeGraphDemoData";
import { clinicalValue } from "../lib/clinicalData";
import { dashboardDate, glucoseOverview } from "../lib/dashboardOverview";

export type DashboardPatient = Pick<Patient, "hba1c" | "fastingGlucose" | "bmi" | "cgmReadings" | "recordedFields" | "currentRiskPct" | "timeInRangePct" | "hasContinuousCGM" | "cgmSummary" | "keyFactors">;
interface DashboardViewProps {
  patient: DashboardPatient;
  onNavigate: (module: NavigationModule) => void;
  sharedRecommendations?: ClinicalRecommendation[];
  selfService?: boolean;
  canViewPredictions?: boolean;
}
const card = "rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6";
const value = (number: number | undefined, unit = "") => clinicalValue(number, unit);

export const DashboardView: React.FC<DashboardViewProps> = ({ patient, onNavigate, sharedRecommendations = [] }) => {
  const [period, setPeriod] = useState<"day" | "all">("day");
  const record = useMemo(() => glucoseOverview(patient.cgmReadings), [patient.cgmReadings]);
  const rows = period === "day" ? record.recent : record.rows;
  const glucose = useMemo(() => glucoseOverview(rows), [rows]);
  const periodLabel = period === "day" ? "Last recorded day" : "All readings";
  const chart = useMemo(() => rows.flatMap((row, index) => {
    const gap = index > 0 && row.timestamp - rows[index - 1].timestamp > 30 * 60 * 1000;
    return [...(gap ? [{ timestamp: row.timestamp - 1, glucose: null }] : []), { timestamp: row.timestamp, glucose: row.cgm }];
  }), [rows]);
  const latest = record.latest;
  const range = [
    { label: "Below range", value: glucose.low, reference: "Below 70 mg/dL", color: "bg-rose-400", text: "text-rose-700" },
    { label: "In range", value: glucose.inRange, reference: "70-180 mg/dL", color: "bg-teal-500", text: "text-teal-700" },
    { label: "Above range", value: glucose.high, reference: "Above 180 mg/dL", color: "bg-amber-400", text: "text-amber-700" },
  ];
  const recommendations = sharedRecommendations.filter(item => item.status === "published");
  const labs = [
    { label: "Fasting glucose", result: value(patient.fastingGlucose, "mmol/L") },
    { label: "LDL cholesterol", result: clinicalValue(patient.recordedFields?.["Low-Density Lipoprotein Cholesterol (mmol/L)"], "mmol/L") },
    { label: "BMI", result: value(patient.bmi, "kg/m²") },
  ];
  return <div className="space-y-5" data-testid="patient-health-dashboard">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="patient-summary-metrics">
      <div className={`${card} !bg-teal-950 text-white`}>
        <div className="flex items-center gap-2 text-sm text-teal-100"><Activity size={16} />Last recorded glucose</div>
        <p className="mt-4 flex flex-wrap items-baseline gap-2"><span className="text-4xl font-semibold tracking-tight">{latest ? value(latest.cgm) : "—"}</span><span className="text-sm text-teal-100">{latest ? "mg/dL" : "No CGM readings"}</span></p>
        <p className="mt-3 text-xs text-teal-100/80">{latest ? `${dashboardDate(latest.timestamp, true)} UTC` : "Your linked record has no sensor data."}</p>
      </div>
      {[
        { label: "Readings in range", result: value(glucose.inRange, "%"), note: `${periodLabel} / 70-180 mg/dL` },
        { label: "Average glucose", result: value(glucose.mean, "mg/dL"), note: periodLabel },
        { label: "HbA1c", result: value(patient.hba1c, "%"), note: "Recorded lab result" },
      ].map(stat => <div key={stat.label} className={card}><p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="mt-4 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{stat.result}</p><p className="mt-3 text-xs text-slate-500">{stat.note}</p></div>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
      <section className={`${card} min-w-0`} aria-labelledby="glucose-trend-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="glucose-trend-heading" className="text-lg font-semibold">Glucose trend</h2><p className="mt-1 text-sm text-slate-500">{rows.length ? `${dashboardDate(rows[0].timestamp)} – ${dashboardDate(rows[rows.length - 1].timestamp)}` : "No dated readings"}</p></div>
          <div className="flex rounded-lg bg-slate-100 p-1" aria-label="Glucose chart period">{([ ["day", "Last recorded day"], ["all", "All readings"] ] as const).map(([id, label]) => <button key={id} aria-pressed={period === id} onClick={() => setPeriod(id)} className={`rounded-md px-2.5 py-2 text-xs font-medium ${period === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div>
        </div>
        {chart.length ? <div className="mt-6 h-64 w-full" role="img" aria-label="Recorded glucose trend with 70 to 180 mg/dL reference range" data-testid="dashboard-glucose-chart">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickCount={4} minTickGap={32} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={timestamp => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...(period === "day" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }) }).format(timestamp)} />
            <YAxis domain={[0, (maximum: number) => Math.max(250, Math.ceil(maximum / 50) * 50)]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <ReferenceArea y1={70} y2={180} fill="#ccfbf1" fillOpacity={0.55} />
            <ReferenceLine y={70} stroke="#14b8a6" strokeDasharray="4 4" /><ReferenceLine y={180} stroke="#14b8a6" strokeDasharray="4 4" />
            <Tooltip labelFormatter={timestamp => `${dashboardDate(Number(timestamp), true)} UTC`} formatter={v => [`${clinicalValue(v)} mg/dL`, "Glucose"]} contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
            <Line dataKey="glucose" type="linear" stroke="#0f766e" strokeWidth={2.5} dot={chart.length === 1 ? { r: 4 } : false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          </LineChart></ResponsiveContainer>
        </div> : <div className="my-6 flex h-52 flex-col items-center justify-center rounded-xl bg-slate-50 text-center"><Activity size={24} className="text-slate-400" /><p className="mt-3 font-medium">No CGM readings available</p><p className="mt-2 max-w-xs text-sm text-slate-500">You can still review your recorded lab results below.</p></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>mg/dL · UTC · Gaps over 30 minutes are left open</span><button onClick={() => onNavigate("patient_monitoring")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">View health details <ArrowRight size={14} /></button></div>
      </section>
      <section className={card} data-testid="patient-range-summary"><h2 className="text-lg font-semibold">Glucose range</h2><p className="mt-1 text-sm text-slate-500">{glucose.rows.length.toLocaleString()} readings / {periodLabel.toLowerCase()}</p>
        {latest ? <><div className="my-6 flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={range.map(item => `${item.label} ${item.value.toFixed(1)}%`).join(", ")}>{range.map(item => <div key={item.label} className={item.color} style={{ width: `${item.value}%` }} />)}</div><div className="space-y-5">{range.map(item => <div key={item.label} className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-medium"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</p><p className="mt-1 pl-4 text-xs text-slate-500">{item.reference}</p></div><span className={`text-xl font-semibold ${item.text}`}>{value(item.value, "%")}</span></div>)}</div><p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">Percentages use available readings. Missing intervals are excluded; your care team can set individual targets.</p></> : <p className="py-12 text-sm text-slate-500">Range statistics need CGM readings.</p>}
      </section>
    </div>
    <section className={card}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Other health results</h2><button onClick={() => onNavigate("patient_reports")} className="text-sm font-semibold text-teal-700">Full report</button></div>
      <dl className="mt-5 grid grid-cols-1 gap-x-8 sm:grid-cols-3">{labs.map(lab => <div key={lab.label} className="border-t border-slate-100 py-4"><dt className="text-sm text-slate-500">{lab.label}</dt><dd className="mt-2 text-xl font-semibold">{lab.result}</dd></div>)}</dl>
    </section>
    {recommendations.length > 0 && <section className={card}><h2 className="text-lg font-semibold">Shared recommendation preview</h2><div className="mt-4 divide-y divide-slate-100">{recommendations.slice(0, 2).map(item => <div key={item.id} className="py-3"><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{item.patientMessage}</p></div>)}</div></section>}
  </div>;
};
