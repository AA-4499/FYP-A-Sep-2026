import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  Download,
  FileText,
  HeartPulse,
  Network,
  Search,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Patient } from "../types";
import { clinicalNumber, clinicalValue } from "../lib/clinicalData";

const panel =
  "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6";
const action =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";
const observed = (value: unknown) =>
  value != null && String(value).trim() !== "";
const dateLabel = (value?: string) =>
  value ? value.replace("T", " ").slice(0, 16) : "No dated observations";

export function RecordSource({ patient }: { patient?: Patient }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
      <Database size={13} className="text-teal-600" />
      <span>
        {patient?.dataSource === "sample"
          ? "Sample preview"
          : "Supabase clinical records"}
      </span>
      {patient && (
        <>
          <span aria-hidden>·</span>
          <span className="break-all font-mono">{patient.id}</span>
        </>
      )}
      <span className="rounded-full bg-slate-100 px-2 py-1">
        Recorded data, not a live sensor feed
      </span>
    </div>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  icon: Icon = Activity,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="hidden rounded-2xl bg-teal-50 p-3 text-teal-700 sm:block">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className={panel}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{note}</p>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm leading-relaxed text-slate-500">
      {children}
    </p>
  );
}

export function CohortOverview({
  patients,
  onOpen,
  onRegistry,
  onMonitor,
}: {
  patients: Patient[];
  onOpen: (id: string) => void;
  onRegistry: () => void;
  onMonitor: () => void;
}) {
  const measured = patients.filter((p) => Number.isFinite(p.hba1c));
  const mean = measured.length
    ? measured.reduce((sum, p) => sum + p.hba1c, 0) / measured.length
    : NaN;
  const sensors = patients.filter((p) => p.hasContinuousCGM);
  const groups = [
    { label: "< 7%", count: measured.filter((p) => p.hba1c < 7).length },
    {
      label: "7–8.5%",
      count: measured.filter((p) => p.hba1c >= 7 && p.hba1c <= 8.5).length,
    },
    { label: "> 8.5%", count: measured.filter((p) => p.hba1c > 8.5).length },
  ];
  const review = [...patients]
    .filter(
      (p) =>
        (Number.isFinite(p.hba1c) && p.hba1c > 8.5) ||
        (p.cgmSummary?.timeBelowRangePct ?? 0) > 0,
    )
    .sort((a, b) => (b.hba1c || 0) - (a.hba1c || 0));
  return (
    <div className="space-y-6">
      <RecordSource />
      <section className="relative overflow-hidden rounded-3xl bg-teal-950 p-6 text-white sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[40px] border-white/5" />
        <p className="relative text-[10px] font-bold uppercase tracking-[.22em] text-teal-200">
          Your clinical workspace
        </p>
        <h1 className="relative mt-3 text-3xl font-bold tracking-tight">
          A clearer view of your cohort.
        </h1>
        <p className="relative mt-3 max-w-lg text-sm leading-relaxed text-teal-100/75">
          Recorded measurements, connected observations, and transparent
          research tools. Every number starts with an accessible patient record.
        </p>
        <button
          className="relative mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-teal-900"
          onClick={onRegistry}
        >
          Explore {patients.length} patient records <ArrowRight size={14} />
        </button>
      </section>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Accessible patient records"
          value={String(patients.length)}
          note="Rows visible to your account"
        />
        <Metric
          label="Mean recorded HbA1c"
          value={clinicalValue(mean, "%")}
          note={`${measured.length} records with an HbA1c measurement`}
        />
        <Metric
          label="Records with dated CGM"
          value={String(sensors.length)}
          note={`${sensors.reduce((sum, p) => sum + (p.cgmReadings?.length ?? 0), 0).toLocaleString()} unique sensor observations`}
        />
        <Metric
          label="Review signals"
          value={String(review.length)}
          note="HbA1c > 8.5% or recorded CGM < 70 mg/dL; not a risk probability"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <section className={panel}>
          <h2 className="text-sm font-bold">Recorded glycaemic profile</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            HbA1c distribution across measured records. Reference bands support
            review; individual targets vary.
          </p>
          {measured.length ? (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groups}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                  isAnimationActive={false}
                    dataKey="count"
                    name="Patient records"
                    fill="#0f766e"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5">
              <Empty>No HbA1c measurements are available.</Empty>
            </div>
          )}
        </section>
        <section className={panel}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Records to review</h2>
            <button
              onClick={onMonitor}
              className="text-xs font-semibold text-teal-700"
            >
              Open monitoring
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Signals from recorded measurements, not new diagnoses.
          </p>
          <div className="mt-5 divide-y divide-slate-100">
            {review.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <div>
                  <p className="max-w-[180px] truncate text-xs font-semibold">
                    {p.name}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {p.hasContinuousCGM
                      ? `${p.cgmReadings?.length} sensor readings`
                      : "Summary measurements"}
                  </p>
                </div>
                <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  {clinicalValue(p.hba1c, "% HbA1c")}
                </span>
                <ArrowRight size={14} className="shrink-0 text-slate-400" />
              </button>
            ))}
            {!review.length && (
              <Empty>No records match these review signals.</Empty>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function PatientRegistry({
  patients,
  onSelectPatient,
  currentPatient,
  onOpenDigitalTwin,
}: {
  patients: Patient[];
  currentPatient: Patient;
  onSelectPatient: (id: string) => void;
  onOpenDigitalTwin: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = patients.filter(
    (p) =>
      `${p.id} ${p.condition}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "cgm" && p.hasContinuousCGM) ||
        (filter === "missing" && !Number.isFinite(p.hba1c))),
  );
  return (
    <div className="space-y-6">
      <RecordSource />
      <Heading
        eyebrow="Patient management"
        title="Patient List & Clinical Profiles"
        description="Search the records available to your account. Missing measurements stay visible, so a gap is never mistaken for a result."
        icon={Users}
      />
      <section className={panel}>
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-48 flex-1">
            <Search
              size={16}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              aria-label="Search patient records"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm focus:outline-teal-600"
              placeholder="Search Patient Number or condition"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter patient records"
            className="rounded-xl border border-slate-200 px-3 text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All records</option>
            <option value="cgm">With CGM observations</option>
            <option value="missing">Missing HbA1c</option>
          </select>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          {visible.length} of {patients.length} accessible records
        </p>
        <div className="mt-4 max-h-[520px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Patient record",
                  "HbA1c",
                  "Fasting glucose",
                  "CGM readings",
                  "",
                ].map((label, i) => (
                  <th key={i} className="whitespace-nowrap px-3 py-4">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => (
                <tr
                  key={p.id}
                  className={
                    currentPatient.id === p.id
                      ? "bg-teal-50/60"
                      : "hover:bg-slate-50"
                  }
                >
                  <td className="px-3 py-4">
                    <button
                      onClick={() => onSelectPatient(p.id)}
                      className="font-semibold text-teal-800"
                    >
                      {p.name}
                    </button>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {p.condition || "Condition not recorded"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3">
                    {clinicalValue(p.hba1c, "%")}
                  </td>
                  <td className="whitespace-nowrap px-3">
                    {clinicalValue(p.fastingGlucose, "mmol/L")}
                  </td>
                  <td className="px-3">{p.cgmReadings?.length ?? 0}</td>
                  <td className="px-3">
                    <button
                      className="whitespace-nowrap font-semibold text-teal-700"
                      onClick={() => onOpenDigitalTwin(p.id)}
                    >
                      Open record <ArrowRight size={12} className="inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <Empty>No records match this search.</Empty>}
        </div>
      </section>
      <PatientSnapshot patient={currentPatient} />
    </div>
  );
}

export function PatientSnapshot({
  patient,
  onPredict,
}: {
  patient: Patient;
  onPredict?: () => void;
}) {
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Heading
          eyebrow="Patient overview"
          title={patient.name}
          description={`${patient.condition || "Condition not recorded"} · ${Number.isFinite(patient.age) ? `${patient.age} years` : "Age not recorded"}`}
          icon={HeartPulse}
        />
        {onPredict && (
          <button onClick={onPredict} className={action}>
            Explore prediction <ArrowRight size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="HbA1c"
          value={clinicalValue(patient.hba1c, "%")}
          note="Converted from recorded mmol/mol"
        />
        <Metric
          label="Fasting plasma glucose"
          value={clinicalValue(patient.fastingGlucose, "mmol/L")}
          note="Converted from recorded mg/dL"
        />
        <Metric
          label="Body mass index"
          value={clinicalValue(patient.bmi, "kg/m²")}
          note="Recorded summary measurement"
        />
        <Metric
          label="CGM readings in 70–180"
          value={clinicalValue(patient.cgmSummary?.timeInRangePct, "%")}
          note="Share of available readings; gaps are excluded"
        />
      </div>
      <section className={panel}>
        <h2 className="text-sm font-bold">Observation window</h2>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-3">
          <div>
            <p className="text-slate-400">First recorded CGM</p>
            <p className="mt-2 font-semibold">
              {dateLabel(patient.cgmSummary?.startDate)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Last recorded CGM</p>
            <p className="mt-2 font-semibold">
              {dateLabel(patient.cgmSummary?.endDate)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Available observations</p>
            <p className="mt-2 font-semibold">
              {patient.cgmReadings?.length ?? 0} dated sensor readings
            </p>
          </div>
        </div>
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
          No validated complication-risk probability, organ stress score, or
          clinician assessment is stored in this record. Those results are not
          inferred from a single laboratory measurement.
        </p>
      </section>
    </div>
  );
}

export function RecordedMonitoring({ patient }: { patient: Patient }) {
  const [range, setRange] = useState("all");
  const rows = useMemo(() => {
    const all = patient.cgmReadings ?? [];
    const cutoff =
      all.length && range !== "all"
        ? all[all.length - 1].timestamp - Number(range) * 86400000
        : -Infinity;
    return all
      .filter((row) => row.timestamp >= cutoff)
      .map((row) => ({ ...row, label: dateLabel(row.date) }));
  }, [patient, range]);
  const values = rows.map((r) => r.cgm);
  const mean = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : NaN;
  const share = (test: (n: number) => boolean) =>
    values.length ? (values.filter(test).length / values.length) * 100 : NaN;
  const events = rows.filter(
    (row) => observed(row.diet) || observed(row.insulin),
  );
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <Heading
        eyebrow="Health monitoring"
        title="Longitudinal glucose observations"
        description="Glucose, meal notes, and insulin annotations from this record. Date ranges end at the last available observation, not today."
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          label="Mean CGM"
          value={clinicalValue(mean, "mg/dL")}
          note={`${rows.length} observations in the selected window`}
        />
        <Metric
          label="Readings in 70–180"
          value={clinicalValue(
            share((v) => v >= 70 && v <= 180),
            "%",
          )}
          note="Reference glucose band, not an individual treatment target"
        />
        <Metric
          label="Readings below 70"
          value={clinicalValue(
            share((v) => v < 70),
            "%",
          )}
          note="Percentage of recorded readings"
        />
        <Metric
          label="Readings above 180"
          value={clinicalValue(
            share((v) => v > 180),
            "%",
          )}
          note="Percentage of recorded readings"
        />
      </div>
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Recorded CGM · mg/dL</h2>
          <select
            aria-label="Recorded glucose range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
          >
            <option value="all">All available dates</option>
            <option value="7">Last 7 recorded days</option>
            <option value="14">Last 14 recorded days</option>
          </select>
        </div>
        {rows.length ? (
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows}>
                <defs>
                  <linearGradient
                    id="recorded-glucose"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <ReferenceArea
                  y1={70}
                  y2={180}
                  fill="#ccfbf1"
                  fillOpacity={0.25}
                />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(n) =>
                    new Date(n).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  tick={{ fontSize: 10 }}
                  minTickGap={45}
                />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip
                  labelFormatter={(n) => new Date(Number(n)).toLocaleString()}
                  formatter={(v: unknown) => [
                    clinicalValue(v, "mg/dL"),
                    "Observed CGM",
                  ]}
                />
                <Area
                  type="linear"
                  dataKey="cgm"
                  stroke="#0f766e"
                  strokeWidth={1.5}
                  fill="url(#recorded-glucose)"
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="mt-5">
            <Empty>
              No valid dated CGM measurements are available for this record.
            </Empty>
          </div>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          Lines connect recorded samples for visual orientation; gaps are not
          measured glucose. Times use your browser timezone; source timestamps
          without a timezone retain their recorded local time.
        </p>
      </section>
      <RecordedAGP rows={rows} />
      <section className={panel}>
        <h2 className="text-sm font-bold">Meal and insulin context</h2>
        <p className="mt-2 text-xs text-slate-500">
          Original annotations, with no inferred carbohydrate or insulin
          quantities.
        </p>
        <div className="mt-5 max-h-64 divide-y divide-slate-100 overflow-auto">
          {events
            .slice(-50)
            .reverse()
            .map((row) => (
              <div
                key={row.timestamp}
                className="grid gap-2 py-3 text-xs sm:grid-cols-[150px_1fr_1fr]"
              >
                <span className="text-slate-400">{row.label}</span>
                <span>{row.diet || "No meal annotation"}</span>
                <span>{row.insulin || "No insulin annotation"}</span>
              </div>
            ))}
          {!events.length && (
            <Empty>
              No meal or insulin annotations accompany these CGM readings.
            </Empty>
          )}
        </div>
      </section>
    </div>
  );
}

function RecordedAGP({
  rows,
}: {
  rows: Array<{ timestamp: number; cgm: number }>;
}) {
  const bins = Array.from({ length: 96 }, (_, index) => ({
    minute: index * 15,
    values: [] as number[],
  }));
  rows.forEach((row) => {
    const date = new Date(row.timestamp);
    bins[
      Math.floor((date.getHours() * 60 + date.getMinutes()) / 15)
    ].values.push(row.cgm);
  });
  const percentile = (values: number[], fraction: number) => {
    const position = (values.length - 1) * fraction;
    const lower = Math.floor(position);
    return (
      values[lower] +
      (values[Math.ceil(position)] - values[lower]) * (position - lower)
    );
  };
  const profile = bins.map((bin) => {
    const sorted = [...bin.values].sort((a, b) => a - b);
    return {
      minute: bin.minute,
      median: sorted.length ? percentile(sorted, 0.5) : null,
      outer: sorted.length
        ? [percentile(sorted, 0.1), percentile(sorted, 0.9)]
        : null,
      inner: sorted.length
        ? [percentile(sorted, 0.25), percentile(sorted, 0.75)]
        : null,
      samples: sorted.length,
    };
  });
  const days = new Set(
    rows.map((row) => new Date(row.timestamp).toLocaleDateString()),
  ).size;
  return (
    <section className={panel}>
      <h2 className="text-sm font-bold">Ambulatory Glucose Profile (AGP)</h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Time-of-day median and percentile bands from {days} observed calendar
        days. These are the spread of observations, not prediction confidence
        intervals.
      </p>
      {rows.length ? (
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={profile}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <ReferenceArea
                y1={70}
                y2={180}
                fill="#ccfbf1"
                fillOpacity={0.3}
              />
              <XAxis
                dataKey="minute"
                type="number"
                domain={[0, 1440]}
                ticks={[0, 360, 720, 1080, 1440]}
                tickFormatter={(value) =>
                  `${Math.floor(value / 60)
                    .toString()
                    .padStart(2, "0")}:00`
                }
                tick={{ fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(value) =>
                  `${Math.floor(Number(value) / 60)}:${String(Number(value) % 60).padStart(2, "0")}`
                }
              />
              <Area
                dataKey="outer"
                name="10th–90th percentile"
                fill="#99f6e4"
                stroke="none"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="inner"
                name="25th–75th percentile"
                fill="#5eead4"
                stroke="none"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="median"
                name="Median CGM"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-5">
          <Empty>CGM observations are required to calculate an AGP.</Empty>
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
        15-minute clock-time bins. Empty bins remain gaps. Short or incomplete
        recordings may not represent usual glucose patterns; the clinical
        consensus recommends checking coverage across 14 days.
      </p>
    </section>
  );
}

const evidenceGroups = [
  [
    "Pancreatic context",
    [
      "Fasting C-peptide (nmol/L)",
      "2-hour Postprandial C-peptide (nmol/L)",
      "Fasting Insulin (pmol/L)",
      "2-hour Postprandial insulin (pmol/L)",
    ],
  ],
  [
    "Kidney context",
    [
      "Creatinine (umol/L)",
      "Estimated Glomerular Filtration Rate  (ml/min/1.73m²)",
      "Blood Urea Nitrogen (mmol/L)",
    ],
  ],
  [
    "Cardiometabolic context",
    [
      "Total Cholesterol (mmol/L)",
      "Triglyceride (mmol/L)",
      "Low-Density Lipoprotein Cholesterol (mmol/L)",
      "High-Density Lipoprotein Cholesterol (mmol/L)",
    ],
  ],
  [
    "Recorded complications",
    [
      "Acute Diabetic Complications",
      "Diabetic Macrovascular Complications",
      "Diabetic Microvascular Complications",
      "Comorbidities",
    ],
  ],
] as const;
export function OrganEvidence({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <Heading
        eyebrow="Digital twin"
        title="Physiological evidence map"
        description="A view of the evidence available for this patient. Organ health cannot be scored from CGM alone; unmeasured states remain unassessed."
        icon={HeartPulse}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {evidenceGroups.map(([title, keys]) => (
          <section className={panel} key={title}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{title}</h2>
              <span className="rounded-full bg-teal-50 px-2 py-1 text-[10px] font-semibold text-teal-700">
                Recorded evidence
              </span>
            </div>
            <dl className="mt-5 divide-y divide-slate-100">
              {keys.map((key) => (
                <div
                  key={key}
                  className="flex flex-wrap justify-between gap-3 py-3 text-xs"
                >
                  <dt className="max-w-[70%] text-slate-500">{key}</dt>
                  <dd className="font-semibold">
                    {observed(patient.recordedFields?.[key])
                      ? String(patient.recordedFields?.[key])
                      : "Not recorded"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <Empty>
        Organ stress, beta-cell capacity, and insulin sensitivity have not been
        clinically estimated for this record. Explore the physiology lab to
        compare explicitly stated research assumptions.
      </Empty>
    </div>
  );
}

export function RecordedGraph({ patient }: { patient: Patient }) {
  const [selected, setSelected] = useState("Type of Diabetes");
  const entries = Object.entries(patient.recordedFields ?? {}).filter(
    ([key, value]) => key !== "Patient Number" && observed(value),
  );
  const selectedValue = entries.find(([key]) => key === selected)?.[1];
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <Heading
        eyebrow="Knowledge graph"
        title="Patient and medical concept map"
        description="Explore recorded relationships between this patient, measurements, and documented conditions. These edges describe stored facts; they do not imply causation or a new diagnosis."
        icon={Network}
      />
      <section className={panel}>
        <div className="rounded-2xl bg-teal-950 p-6 text-white">
          <p className="text-[10px] uppercase tracking-widest text-teal-200">
            Patient record
          </p>
          <h2 className="mt-2 break-all text-xl font-bold">{patient.id}</h2>
          <p className="mt-2 text-xs text-teal-100">
            {entries.length} recorded attributes · patient_summary
          </p>
        </div>
        <div className="mx-auto h-8 w-px bg-teal-200" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(([key, value]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              aria-pressed={key === selected}
              className={`rounded-2xl border p-4 text-left transition ${selected === key ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500" : "border-slate-200 hover:border-teal-300"}`}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-teal-600">
                has recorded attribute
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">{key}</p>
              <p className="mt-3 break-words text-sm font-bold text-slate-900">
                {String(value)}
              </p>
            </button>
          ))}
        </div>
        {!entries.length && (
          <Empty>No recorded attributes are available.</Empty>
        )}
      </section>
      {selectedValue !== undefined && (
        <section className={panel}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">
            Selected relationship
          </p>
          <p className="mt-3 break-words text-sm">
            <strong>{patient.id}</strong> → has recorded attribute →{" "}
            <strong>{selected}</strong> → {String(selectedValue)}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Source: patient_summary. No inferred risk, recommendation, or organ
            impairment is added.
          </p>
        </section>
      )}
    </div>
  );
}

export function RecordedReport({ patient }: { patient: Patient }) {
  const download = () => {
    const rows = [
      ["Field", "Recorded value"],
      ...Object.entries(patient.recordedFields ?? {}).map(([key, value]) => [
        key,
        value == null ? "" : String(value),
      ]),
    ];
    const safe = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((row) => row.map(safe).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinical-record-${patient.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Heading
          eyebrow="Reports"
          title="Clinical Health & Digital Twin Dossier"
          description="A factual record summary, with recorded measurements and explicitly calculated CGM statistics. No simulated improvements or clinician signature is generated."
          icon={FileText}
        />
        <button className={action} onClick={download}>
          <Download size={14} />
          Export recorded fields
        </button>
      </div>
      <PatientSnapshot patient={patient} />
      <OrganEvidence patient={patient} />
      <section className={panel}>
        <h2 className="text-sm font-bold">Complete recorded summary</h2>
        <dl className="mt-4 divide-y divide-slate-100">
          {Object.entries(patient.recordedFields ?? {}).map(([key, value]) => (
            <div key={key} className="grid gap-2 py-3 text-xs sm:grid-cols-2">
              <dt className="text-slate-500">{key}</dt>
              <dd className="break-words font-semibold">
                {observed(value) ? String(value) : "Not recorded"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
