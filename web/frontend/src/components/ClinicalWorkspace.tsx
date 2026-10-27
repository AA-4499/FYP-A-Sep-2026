import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  Download,
  FileText,
  HeartPulse,
  Network,
  Search,
  Users,
} from "lucide-react";
import { DoctorDashboard } from "./doctor/DoctorDashboard";
import { LongitudinalMonitoringView } from "./LongitudinalMonitoringView";
import type { Patient, NavigationModule } from "../types";
import { clinicalValue } from "../lib/clinicalData";

const panel =
  "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6";
const action =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";
const observed = (value: unknown) =>
  value != null && String(value).trim() !== "";
const dateLabel = (value?: string) =>
  value ? value.replace("T", " ").slice(0, 16) : "No dated observations";

export function RecordSource({ patient }: { patient?: Patient }) {
  if (patient?.dataSource !== "sample") return null;
  return <p className="text-xs font-medium text-amber-700">Sample preview</p>;
}

function Heading({
  eyebrow,
  title,
  description,
  icon: Icon = Activity,
}: {
  eyebrow: string;
  title: string;
  description?: string;
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
        {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={panel}>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
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

export function CohortOverview({ patients, onOpen, onRegistry }: {
  patients: Patient[];
  onOpen: (id: string) => void;
  onRegistry: () => void;
}) {
  return <DoctorDashboard patients={patients} onOpen={onOpen} onRegistry={onRegistry} />;
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
        title="Patient list"
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
        />
        <Metric
          label="Fasting plasma glucose"
          value={clinicalValue(patient.fastingGlucose, "mmol/L")}
        />
        <Metric
          label="Body mass index"
          value={clinicalValue(patient.bmi, "kg/m²")}
        />
        <Metric
          label="CGM readings in 70–180"
          value={clinicalValue(patient.cgmSummary?.timeInRangePct, "%")}
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

export function RecordedMonitoring({
  patient,
  onNavigate = () => {},
  allowPatientSelection = true,
}: {
  patient: Patient;
  onNavigate?: (module: NavigationModule) => void;
  allowPatientSelection?: boolean;
}) {
  const events = (patient.cgmReadings ?? []).filter(
    (row) => observed(row.diet) || observed(row.insulin),
  );
  return (
    <div className="space-y-5">
      <RecordSource patient={patient} />
      <LongitudinalMonitoringView
        patient={patient}
        onNavigate={onNavigate}
        allowPatientSelection={allowPatientSelection}
      />
      <section className={panel}>
        <h2 className="text-sm font-bold">Meal and insulin context</h2>
        <p className="mt-2 text-xs text-slate-500">
          Original annotations across the available record. No inferred
          carbohydrate or insulin quantities.
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
                <span className="text-slate-400">{dateLabel(row.date)}</span>
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
          title="Health report"
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
