import React, { useState } from "react";
import { Plus, Trash2, CalendarClock, ChevronDown } from "lucide-react";
import {
  clockInput,
  compileScenario,
  cookedRiceCarbohydrate,
  cookedRiceReferenceUrl,
  eventNames,
  recordTime,
  type ScenarioDraft,
  type ScenarioKind,
} from "../lib/scenario";

const input =
  "mt-1.5 w-full min-w-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-xs text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-50";
export function ScenarioBuilder({
  value,
  onChange,
  start,
  hours,
  disabled = false,
  onRun,
  onReset,
}: {
  value: ScenarioDraft[];
  onChange: (events: ScenarioDraft[]) => void;
  start?: string;
  hours: number;
  disabled?: boolean;
  onRun: (events: ReturnType<typeof compileScenario>) => boolean | void;
  onReset: () => void;
}) {
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState("");
  const origin = start ? recordTime(start) : NaN;
  const patch = (id: string, update: Partial<ScenarioDraft>) => {
    onChange(
      value.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...update };
        if (
          next.kind === "meal" &&
          next.carbohydrateSource === "usda-cooked-white-rice"
        ) {
          const estimate = cookedRiceCarbohydrate(Number(next.amount));
          next.carbohydrate = estimate === null ? "" : String(estimate);
        }
        return next;
      }),
    );
    setError("");
  };
  return (
    <form
      className="mt-5 space-y-4"
      data-testid="scenario-builder"
      onInvalidCapture={(event) => {
        const details = (event.target as HTMLElement).closest("details");
        if (details) details.open = true;
      }}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const completed = onRun(compileScenario(value, start || "", hours));
          if (completed !== false) setSubmitted(JSON.stringify(value));
          setError("");
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Check the event details.",
          );
        }
      }}
    >
      <div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarClock size={14} /> Record clock · UTC
        </p>
        <p className="mt-1">
          {Number.isFinite(origin)
            ? `${clockInput(origin).replace("T", " ")} → ${clockInput(origin + hours * 3600000).replace("T", " ")}`
            : "Waiting for the seed observation."}
        </p>
        <p className="mt-1 text-slate-400">
          Use the record date, not today's date. Next-day events are supported.
        </p>
      </div>
      <label className="block text-xs font-semibold text-slate-600">
        Add an event
        <select
          aria-label="Add scenario event"
          className={input}
          value=""
          disabled={disabled || !Number.isFinite(origin) || value.length >= 12}
          onChange={(event) => {
            if (!event.target.value) return;
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                kind: event.target.value as ScenarioKind,
                at: "",
                description: "",
                amount: "",
                carbohydrate: "",
                absorption: "45",
                intensity: "moderate",
              },
            ]);
            setError("");
          }}
        >
          <option value="">Choose an event...</option>
          {Object.entries(eventNames).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!value.length && (
        <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs leading-relaxed text-slate-400">
          <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <Plus size={20} />
          </span>
          <p className="font-medium text-slate-600">Start with one event</p>
          <p className="mt-1 text-[11px]">
            Add a meal, injection or activity to compare with the baseline.
          </p>
        </div>
      )}
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        {value.map((row, index) => (
          <details
            key={row.id}
            open
            className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition open:border-teal-200"
            data-testid="scenario-event"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3.5 text-xs font-semibold text-slate-700">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[11px] font-bold text-teal-700">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                {eventNames[row.kind]}
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  {row.at
                    ? row.at.replace("T", " ") + " UTC"
                    : "Set the time and details"}
                </span>
              </span>
              <ChevronDown
                size={14}
                className="shrink-0 text-slate-400 transition group-open:rotate-180"
              />
            </summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              <label className="block text-[11px] text-slate-500">
                {row.kind === "meal"
                  ? "What did you eat / drink?"
                  : row.kind === "insulin"
                    ? "Rapid-acting insulin name"
                    : row.kind === "medication"
                      ? "Medicine name and formulation"
                      : "Describe the event"}
                <input
                  aria-label={`Event ${index + 1} description`}
                  className={input}
                  required
                  maxLength={160}
                  value={row.description}
                  placeholder={
                    row.kind === "meal"
                      ? "e.g. rice, vegetables and chicken"
                      : row.kind === "medication"
                        ? "e.g. metformin immediate-release"
                        : "Enter details"
                  }
                  onChange={(event) =>
                    patch(row.id, { description: event.target.value })
                  }
                />
              </label>
              <label className="block text-[11px] text-slate-500">
                Date and time · UTC
                <input
                  aria-label={`Event ${index + 1} time`}
                  type="datetime-local"
                  className={input}
                  required
                  step={60}
                  min={clockInput(Math.floor(origin / 60000) * 60000 + 60000)}
                  max={clockInput(
                    Math.floor(origin / 60000) * 60000 +
                      (hours * 60 - 1) * 60000,
                  )}
                  value={row.at}
                  onChange={(event) =>
                    patch(row.id, { at: event.target.value })
                  }
                />
              </label>
              {["meal", "insulin", "medication", "activity"].includes(
                row.kind,
              ) && (
                <label className="block text-[11px] text-slate-500">
                  {row.kind === "meal"
                    ? "Total food / drink mass (g)"
                    : row.kind === "insulin"
                      ? "Hypothetical dose (units)"
                      : row.kind === "medication"
                        ? "Dose (mg) · context only"
                        : "Duration (minutes)"}
                  <input
                    aria-label={`Event ${index + 1} amount`}
                    type="number"
                    min={row.kind === "activity" ? 1 : 0.1}
                    step={row.kind === "activity" ? 1 : 0.1}
                    max={
                      row.kind === "meal"
                        ? 2000
                        : row.kind === "insulin"
                          ? 20
                          : row.kind === "activity"
                            ? 120
                            : undefined
                    }
                    required
                    className={input}
                    value={row.amount}
                    onChange={(event) =>
                      patch(row.id, { amount: event.target.value })
                    }
                  />
                </label>
              )}
              {row.kind === "meal" && (
                <>
                  <label className="block text-[11px] text-slate-500">
                    Carbohydrate entry method
                    <select
                      aria-label={`Event ${index + 1} carbohydrate source`}
                      className={input}
                      value={row.carbohydrateSource || "manual"}
                      onChange={(event) =>
                        patch(row.id, {
                          carbohydrateSource: event.target
                            .value as ScenarioDraft["carbohydrateSource"],
                        })
                      }
                    >
                      <option value="manual">
                        Manual · food label / measured estimate
                      </option>
                      <option value="usda-cooked-white-rice">
                        Cooked white rice (USDA estimate)
                      </option>
                    </select>
                  </label>
                  <label className="block text-[11px] text-slate-500">
                    Carbohydrate excluding fibre (g), not food weight
                    <input
                      aria-label={`Event ${index + 1} carbohydrate`}
                      type="number"
                      required
                      min={0.1}
                      max={200}
                      step={0.1}
                      className={input}
                      readOnly={
                        row.carbohydrateSource === "usda-cooked-white-rice"
                      }
                      value={row.carbohydrate}
                      onChange={(event) =>
                        patch(row.id, { carbohydrate: event.target.value })
                      }
                    />
                    <span className="mt-1 block text-[10px]">
                      Use the food label or a measured estimate. Food weight is
                      not carbohydrate weight; names do not determine nutrients.
                    </span>
                  </label>
                  {row.carbohydrateSource === "usda-cooked-white-rice" ? (
                    <p className="rounded-lg bg-teal-50 p-3 text-[10px] leading-relaxed text-teal-900">
                      Reference estimate: {row.amount || "—"} g cooked white
                      rice → {row.carbohydrate || "—"} g carbohydrate excluding
                      fibre. Uses (28.17 − 0.4) g / 100 g; recipes and water
                      content vary. Only use if the entire portion is cooked
                      white rice, not dry rice or a mixed meal.{" "}
                      <a
                        href={cookedRiceReferenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        USDA source
                      </a>
                    </p>
                  ) : (
                    Number(row.amount) > 0 &&
                    Number(row.carbohydrate) / Number(row.amount) >= 0.9 && (
                      <p
                        role="status"
                        className="rounded-lg bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-950"
                      >
                        Check units: this specifies{" "}
                        {(
                          (Number(row.carbohydrate) / Number(row.amount)) *
                          100
                        ).toFixed(0)}
                        % carbohydrate by food weight. Food weight and
                        carbohydrate weight are different. If this is cooked
                        rice, select the cooked-rice reference instead of
                        copying the portion weight.
                      </p>
                    )
                  )}
                  <label className="block text-[11px] text-slate-500">
                    Assumed absorption speed
                    <select
                      aria-label={`Event ${index + 1} absorption`}
                      className={input}
                      value={row.absorption}
                      onChange={(event) =>
                        patch(row.id, { absorption: event.target.value })
                      }
                    >
                      <option value="25">Faster · e.g. a sugary drink</option>
                      <option value="45">Typical · mixed meal</option>
                      <option value="75">
                        Slower · mixed meal with fat / fibre
                      </option>
                    </select>
                    <span className="mt-1 block text-[10px]">
                      Illustrative timing assumption, not a food-specific
                      measured response.
                    </span>
                  </label>
                </>
              )}
              {row.kind === "activity" && (
                <label className="block text-[11px] text-slate-500">
                  Assumed intensity
                  <select
                    aria-label={`Event ${index + 1} intensity`}
                    className={input}
                    value={row.intensity}
                    onChange={(event) =>
                      patch(row.id, {
                        intensity: event.target
                          .value as ScenarioDraft["intensity"],
                      })
                    }
                  >
                    <option value="moderate">
                      Moderate aerobic · e.g. walking
                    </option>
                    <option value="intense">
                      Intense · possible stress-related rise
                    </option>
                  </select>
                </label>
              )}
              {["medication", "stress", "illness"].includes(row.kind) && (
                <p className="rounded-lg bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-900">
                  Context only: recorded in the scenario, but excluded from the
                  numeric curve. A reliable patient-specific effect is not
                  available. This scenario will be labelled incomplete.
                </p>
              )}
              {row.kind === "insulin" && (
                <p className="text-[10px] leading-relaxed text-slate-400">
                  Only a hypothetical rapid-acting injection is represented.
                  Basal insulin, pumps and non-insulin injections require
                  different models. No dose is suggested.
                </p>
              )}
              <button
                type="button"
                aria-label={`Remove event ${index + 1}`}
                className="inline-flex items-center gap-1 text-[11px] text-red-600"
                onClick={() => {
                  onChange(value.filter((item) => item.id !== row.id));
                  setError("");
                }}
              >
                <Trash2 size={12} />
                Remove event
              </button>
            </div>
          </details>
        ))}
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900"
        >
          {error}
        </p>
      )}
      {!!value.length && submitted && submitted !== JSON.stringify(value) && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800"
        >
          Draft changes are not applied. Run again to update the curves.
        </p>
      )}
      <p className="text-[10px] leading-relaxed text-slate-400">
        Up to 12 events. Changes are drafts until you run the simulation. Meals,
        rapid insulin and activity use an unvalidated physiology model, not a
        treatment prediction.
      </p>
      <button
        type="submit"
        disabled={disabled || !Number.isFinite(origin) || !value.length}
        className="w-full rounded-xl bg-teal-700 px-4 py-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
      >
        Run what-if simulation
      </button>
      <button
        type="button"
        className="w-full text-xs text-slate-500 hover:text-teal-700"
        onClick={() => {
          onChange([]);
          onReset();
          setError("");
          setSubmitted("");
        }}
      >
        Clear events and return to baseline
      </button>
    </form>
  );
}
