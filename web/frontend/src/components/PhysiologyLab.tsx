import { ScenarioBuilder } from "./ScenarioBuilder";
import { type ScenarioDraft, type compileScenario } from "../lib/scenario";
import React, { useMemo, useState } from "react";
import { Activity, ArrowRight, FlaskConical, RotateCcw } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Patient } from "../types";
import { clinicalNumber, clinicalValue } from "../lib/clinicalData";
import { simulatePhysiology } from "../lib/physiology";

const card =
  "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const input =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-teal-600";
export function PhysiologyLab({ patient }: { patient: Patient }) {
  const last = patient.cgmReadings?.[patient.cgmReadings.length - 1];
  const [hours, setHours] = useState(6);
  const measuredWeight = clinicalNumber(
    patient.recordedFields?.["Weight (kg)"],
  );
  const measuredBasal = clinicalNumber(
    patient.recordedFields?.["Fasting Plasma Glucose (mg/dl)"],
  );
  const [weight, setWeight] = useState(
    Number.isFinite(measuredWeight) ? measuredWeight : 70,
  );
  const [basal, setBasal] = useState(
    Number.isFinite(measuredBasal)
      ? Math.min(250, Math.max(60, measuredBasal))
      : 120,
  );
  const [beta, setBeta] = useState(0.5);
  const [sensitivity, setSensitivity] = useState(0.7);
  const absorption = 45;
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [applied, setApplied] = useState<ReturnType<
    typeof compileScenario
  > | null>(null);
  const events = applied?.events || [];
  const result = useMemo(() => {
    if (!last) return { rows: [], error: "" };
    try {
      const assumptions = {
        basalGlucose: basal,
        weightKg: weight,
        betaResponse: beta,
        sensitivity,
        absorptionMinutes: absorption,
      };
      const baseline = simulatePhysiology(last.cgm, hours, assumptions);
      const scenario = simulatePhysiology(last.cgm, hours, assumptions, events);
      return {
        rows: scenario.map((row, i) => ({
          ...row,
          baseline: baseline[i].glucose,
        })),
        error: "",
      };
    } catch (error) {
      return {
        rows: [],
        error:
          error instanceof Error ? error.message : "Simulation unavailable.",
      };
    }
  }, [last, hours, basal, weight, beta, sensitivity, absorption, events]);
  const final = result.rows[result.rows.length - 1];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-xs leading-relaxed text-indigo-900">
        <div className="flex items-center gap-2 font-bold">
          <FlaskConical size={16} />
          Research physiology sandbox
        </div>
        <p className="mt-2">
          Seeded from the last recorded CGM. Pancreatic response and insulin
          sensitivity are hypothetical assumptions, not measurements of this
          patient. This simulation is unvalidated and is not a treatment or
          insulin-dosing tool.
        </p>
      </div>
      {!last ? (
        <section className={card}>
          <h2 className="font-bold">CGM history is required</h2>
          <p className="mt-3 text-sm text-slate-500">
            No valid dated CGM readings are available for this record. A
            demonstration curve will not be substituted.
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Recorded starting CGM", clinicalValue(last.cgm, "mg/dL")],
              ["Simulated ending CGM", clinicalValue(final?.glucose, "mg/dL")],
              ["Scenario events", String(applied?.schedule.length || 0)],
              ["Seed observation", last.date.replace("T", " ").slice(0, 16)],
            ].map(([label, value]) => (
              <div key={label} className={card}>
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="mt-3 text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <section className={card}>
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold">
                      Glucose response and recovery
                    </h2>
                    <p className="mt-2 text-xs text-slate-500">
                      CGM-like sensor response · mg/dL · time since the seed
                      observation
                    </p>
                  </div>
                  <select
                    aria-label="Physiology horizon"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    value={hours}
                    onChange={(e) => {
                      setHours(Number(e.target.value));
                      setDrafts([]);
                      setApplied(null);
                    }}
                  >
                    {[6, 12].map((h) => (
                      <option key={h} value={h}>
                        {h} hours
                      </option>
                    ))}
                  </select>
                </div>
                {result.error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-amber-50 p-4 text-xs text-amber-900"
                  >
                    {result.error}
                  </p>
                )}
                <div
                  className="mt-6 h-80"
                  aria-label="Physiology baseline and hypothetical event comparison"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.rows}>
                      <CartesianGrid vertical={false} stroke="#f1f5f9" />
                      <ReferenceArea
                        y1={70}
                        y2={180}
                        fill="#ccfbf1"
                        fillOpacity={0.3}
                      />
                      <XAxis
                        dataKey="minute"
                        tickFormatter={(v) => `${v / 60}h`}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        labelFormatter={(v) => `${v} minutes after seed`}
                        formatter={(v: unknown) => clinicalValue(v, "mg/dL")}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        dataKey="baseline"
                        name="No added events (simulation)"
                        stroke="#94a3b8"
                        dot={false}
                        strokeDasharray="5 5"
                        isAnimationActive={false}
                      />
                      <Line
                        dataKey="glucose"
                        name="Hypothetical scenario"
                        stroke="#0f766e"
                        dot={false}
                        strokeWidth={2.5}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className={card}>
                <h2 className="text-sm font-bold">
                  Delayed endogenous insulin response
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Relative model activity, not measured plasma insulin. Glucose
                  stimulates secretion; secretion and tissue action have
                  different delays.
                </p>
                <div className="mt-5 h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.rows}>
                      <XAxis
                        dataKey="minute"
                        tickFormatter={(v) => `${v / 60}h`}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        dataKey="secretion"
                        name="Endogenous response (relative)"
                        stroke="#6366f1"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        dataKey="action"
                        name="Delayed insulin action (relative)"
                        stroke="#14b8a6"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className={card}>
                <h2 className="text-sm font-bold">Why the curve changes</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  {[
                    [
                      "1",
                      "Absorption",
                      "Each meal has its own two-stage absorption, with a selected speed; food weight is not carbohydrate weight.",
                    ],
                    [
                      "2",
                      "Feedback",
                      "Higher glucose can stimulate remaining beta-cell response; insulin action is delayed.",
                    ],
                    [
                      "3",
                      "Recovery",
                      "Glucose use, delayed insulin action and hepatic production shape recovery. Moderate activity increases uptake; intense activity can add a hepatic stress response. No periodic rise is forced.",
                    ],
                  ].map(([n, title, text]) => (
                    <div key={n} className="rounded-2xl bg-slate-50 p-4">
                      <span className="text-xs font-bold text-teal-700">
                        {n}
                      </span>
                      <h3 className="mt-2 text-xs font-bold">{title}</h3>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
                <a
                  href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2769591/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-teal-700"
                >
                  Read the physiological modelling reference{" "}
                  <ArrowRight size={12} />
                </a>
                <p className="mt-3 text-[10px] text-slate-400">
                  Reduced educational model inspired by compartment modelling;
                  not the published GIM equations or a validated digital twin.
                </p>
              </section>
            </div>
            <aside className={`${card} space-y-5`}>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Activity size={16} className="text-teal-600" />
                Scenario builder
              </h2>
              <ScenarioBuilder
                value={drafts}
                onChange={setDrafts}
                start={last.date}
                hours={hours}
                onRun={setApplied}
                onReset={() => setApplied(null)}
              />
              {applied && (
                <div
                  data-testid="physiology-applied-schedule"
                  className="space-y-2 rounded-xl bg-teal-50 p-3 text-[11px] leading-relaxed text-teal-900"
                >
                  <p className="font-semibold">Applied schedule (UTC)</p>
                  {applied.schedule.map((row) => (
                    <p key={row.id}>
                      {row.at.replace("T", " ")} - {row.description}
                    </p>
                  ))}
                  {!!applied.unmodelled.length && (
                    <p className="rounded-lg bg-amber-100 p-2 text-amber-950">
                      Incomplete scenario: {applied.unmodelled.join("; ")}.
                      Context only; excluded from the numeric curve.
                    </p>
                  )}
                  <p>
                    Draft event edits apply after running again. Assumption
                    controls below update the applied scenario immediately.
                  </p>
                </div>
              )}
              <div className="space-y-4 border-t border-slate-100 pt-5">
                <h3 className="text-xs font-bold">Visible model assumptions</h3>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  Starting glucose is measured. Other states are assumed. CGM
                  alone cannot identify pancreatic secretion or sensitivity.
                </p>
                <label className="block text-[11px] text-slate-500">
                  Basal reference · mg/dL
                  <input
                    className={input}
                    type="number"
                    min={60}
                    max={250}
                    value={basal}
                    onChange={(e) => setBasal(e.target.valueAsNumber)}
                  />
                  <span className="mt-1 block text-[10px]">
                    {Number.isFinite(measuredBasal) &&
                    measuredBasal >= 60 &&
                    measuredBasal <= 250
                      ? "Initialized from recorded fasting glucose"
                      : "Assumed starting reference; not a clinical estimate"}
                  </span>
                </label>
                <label className="block text-[11px] text-slate-500">
                  Weight · kg
                  <input
                    className={input}
                    type="number"
                    min={30}
                    max={250}
                    value={weight}
                    onChange={(e) => setWeight(e.target.valueAsNumber)}
                  />
                  <span className="mt-1 block text-[10px]">
                    {Number.isFinite(measuredWeight)
                      ? "Initialized from recorded weight"
                      : "Assumed 70 kg; weight not recorded"}
                  </span>
                </label>
                {[
                  ["Beta-cell responsiveness", beta, setBeta, 1.5],
                  ["Insulin sensitivity", sensitivity, setSensitivity, 2],
                ].map(([label, value, setter, max]) => (
                  <label
                    key={String(label)}
                    className="block text-[11px] text-slate-500"
                  >
                    {String(label)}{" "}
                    <strong className="float-right text-slate-800">
                      {Number(value).toFixed(
                        label === "Absorption time (minutes)" ? 0 : 2,
                      )}
                    </strong>
                    <input
                      className="mt-3 w-full accent-teal-700"
                      type="range"
                      min={label === "Absorption time (minutes)" ? 20 : 0}
                      max={Number(max)}
                      step={label === "Absorption time (minutes)" ? 5 : 0.05}
                      value={Number(value)}
                      aria-label={String(label)}
                      onChange={(e) =>
                        (
                          setter as React.Dispatch<React.SetStateAction<number>>
                        )(Number(e.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="flex items-center gap-2 text-xs font-semibold text-slate-500"
                onClick={() => {
                  setDrafts([]);
                  setApplied(null);
                  setBeta(0.5);
                  setSensitivity(0.7);
                }}
              >
                <RotateCcw size={13} />
                Clear events and response assumptions
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
