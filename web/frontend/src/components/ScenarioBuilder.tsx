import { ActivityPicker } from "./ActivityPicker";
import { InsulinPicker } from "./InsulinPicker";
import { FoodCompositionPicker } from "./FoodCompositionPicker";
import { foodCarbohydrate } from "../lib/scenario";
import type {FoodReference} from '../lib/foodComposition';
import React, { useState } from "react";
import { Plus, Trash2, CalendarClock, ChevronDown, Utensils, Syringe, Footprints } from "lucide-react";
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
  engine = 'physiology',
  allowedKinds,
}: {
  value: ScenarioDraft[];
  onChange: (events: ScenarioDraft[]) => void;
  start?: string;
  hours: number;
  disabled?: boolean;
  onRun: (events: ReturnType<typeof compileScenario>) => boolean | void | Promise<boolean | void>;
  onReset: () => void;
  engine?: 'physiology' | 'conditional' | 'auxiliary' | 'integrated';
  allowedKinds?: ScenarioKind[];
}) {
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState("");
  const origin = start ? recordTime(start) : NaN;
  const referenceMacros=(reference:FoodReference|undefined,grams:number)=>{
    const values=[reference?.protein_per_100g,reference?.fat_per_100g,reference?.fiber_per_100g];
    return ['auxiliary','integrated'].includes(engine)&&values.every(v=>typeof v==='number'&&Number.isFinite(v))
      ? {protein:String(Number((values[0]!*grams/100).toFixed(1))),fat:String(Number((values[1]!*grams/100).toFixed(1))),fiber:String(Number((values[2]!*grams/100).toFixed(1)))}
      : {protein:'',fat:'',fiber:''};
  };
  const patch = (id: string, update: Partial<ScenarioDraft>) => {
    onChange(
      value.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...update };
        if (
          next.kind === "meal" &&
          next.carbohydrateSource === "usda-cooked-white-rice"
        ) {
          const estimate = cookedRiceCarbohydrate(Number(next.amount), engine !== 'physiology' ? 'total' : 'available');
          next.carbohydrate = estimate === null ? "" : String(estimate);
        }
        if (next.kind === "meal" && next.carbohydrateSource === "food-composition") {
          const estimate = foodCarbohydrate(next.foodReference, Number(next.amount), engine === 'physiology' ? 'physiology' : 'conditional');
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
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          const submittedDraft = JSON.stringify(value);
          const completed = await onRun(compileScenario(value, start || "", hours, engine));
          if (completed !== false) setSubmitted(submittedDraft);
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
          <CalendarClock size={14} /> Record clock · {engine !== 'physiology' ? 'source clock' : 'UTC'}
        </p>
        <p className="mt-1">
          {Number.isFinite(origin)
            ? `${clockInput(origin).replace("T", " ")} → ${clockInput(origin + hours * 3600000).replace("T", " ")}`
            : "Waiting for the seed observation."}
        </p>
        <p className="mt-1 text-slate-400">
          Use the record date, not today’s date. Next-day events are supported.
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
            const kind = event.target.value as ScenarioKind;
            const isMeal = kind === "meal";
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                kind,
                at: "",
                description: isMeal ? "White Rice" : "",
                amount: isMeal ? "150" : "",
                carbohydrate: isMeal ? "42.3" : "",
                carbohydrateSource: isMeal ? "manual" : undefined,
                absorption: "45",
                intensity: "moderate",
                insulinFormulation: 'rapid',
                protein: '', fat: '', fiber: '', met: '',
              },
            ]);
            setError("");
          }}
        >
          <option value="">Choose an event…</option>
          {Object.entries(eventNames).filter(([kind]) => !allowedKinds || allowedKinds.includes(kind as ScenarioKind)).map(([kind, label]) => (
            <option key={kind} value={kind}>
              {['conditional','integrated'].includes(engine) && kind === 'insulin' ? 'Insulin bolus (rapid / regular)' : label}
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
            {engine === 'integrated' ? 'Add food, a supported bolus or physical activity to the same prediction.' : engine === 'auxiliary' ? 'Add meals with their macronutrients or physical activity to run the trained auxiliary model.' : engine === 'conditional' ? 'Add a meal or supported bolus to compare with the same recorded baseline.' : 'Add a meal, injection or activity to compare with the baseline.'}
          </p>
        </div>
      )}
      <fieldset disabled={disabled} className="min-w-0 space-y-3">
        {value.map((row, index) => (
          <details
            key={row.id}
            open
            className={`group min-w-0 rounded-2xl border bg-white shadow-sm transition ${row.kind==='meal'?'border-teal-200/70':row.kind==='insulin'?'border-blue-200/70':row.kind==='activity'?'border-orange-200/70':'border-slate-200'}`}
            data-testid="scenario-event"
          >
            <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 text-xs font-semibold text-slate-700 group-open:rounded-b-none bg-gradient-to-r to-white ${row.kind==='meal'?'from-teal-50':row.kind==='insulin'?'from-blue-50':row.kind==='activity'?'from-orange-50':'from-slate-50'}`}>
              <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm ${row.kind==='meal'?'border-teal-100 text-teal-700':row.kind==='insulin'?'border-blue-100 text-blue-600':row.kind==='activity'?'border-orange-100 text-amber-700':'border-slate-100 text-slate-500'}`}>
                {row.kind==='meal'?<Utensils size={19}/>:row.kind==='insulin'?<Syringe size={19}/>:row.kind==='activity'?<Footprints size={19}/>:<CalendarClock size={19}/>}
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-white">{index+1}</span>
              </span>
              <span className="min-w-0 flex-1">
                {['conditional','integrated'].includes(engine) && row.kind === 'insulin' ? `${row.insulinFormulation === 'regular' ? 'Regular' : 'Rapid-acting'} insulin bolus` : eventNames[row.kind]}
                <span className="mt-1 block text-[10px] font-normal text-slate-400">
                  {row.at
                    ? row.at.replace("T", " ") + (engine !== 'physiology' ? ' · source clock' : ' UTC')
                    : "Set the time and details"}
                </span>
              </span>
              <ChevronDown
                size={14}
                className="shrink-0 text-slate-400 transition group-open:rotate-180"
              />
            </summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              {row.kind==='insulin'&&engine!=='physiology'&&<InsulinPicker index={index+1} formulation={row.description?row.insulinFormulation:undefined} disabled={disabled} onSelect={(description,insulinFormulation)=>patch(row.id,{description,insulinFormulation})}/>}
              {!(engine==='integrated'&&row.kind==='activity')&&<label className="block text-[11px] text-slate-500">
                {row.kind === "meal"
                  ? "What did you eat / drink?"
                  : row.kind === "insulin"
                    ? engine !== 'physiology' ? 'Insulin name (context)' : "Rapid-acting insulin name"
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
              </label>}
              {engine==='integrated'&&row.kind==='activity'&&<ActivityPicker index={index+1} activityId={row.activityId} minutes={row.amount} disabled={disabled} onSelect={(activityId,description,met)=>patch(row.id,{activityId,description,met:String(met)})}/>}
              <label className="block text-[11px] text-slate-500">
                Date and time · {engine !== 'physiology' ? 'source clock' : 'UTC'}
                <input
                  aria-label={`Event ${index + 1} time`}
                  type="datetime-local"
                  className={input}
                  required
                  step={60}
                  min={clockInput(Math.floor(origin / 60000) * 60000 + 60000)}
                  max={clockInput(
                    Math.floor(origin / 60000) * 60000 +
                      (hours * 60 - (['auxiliary','integrated'].includes(engine) ? 0 : 1)) * 60000,
                  )}
                  value={row.at}
                  onChange={(event) =>
                    patch(row.id, { at: event.target.value })
                  }
                />
              </label>
              {["insulin", "medication", "activity"].includes(row.kind) && (
                <label className="block text-[11px] text-slate-500">
                  {row.kind === "insulin"
                    ? "Hypothetical dose (units)"
                    : row.kind === "medication"
                      ? "Dose (mg) · context only"
                      : "Duration (minutes)"}
                  <input
                    aria-label={`Event ${index + 1} amount`}
                    type="number"
                    min={row.kind === "activity" ? (engine === 'auxiliary' ? 15 : 1) : 0.1}
                    step={row.kind === "activity" ? (engine === 'auxiliary' ? 15 : 1) : 0.1}
                    max={
                      row.kind === "insulin"
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
                  <FoodCompositionPicker
                    portion={row.amount || "150"}
                    carbohydrate={row.carbohydrate || "42.3"}
                    description={row.description || "White Rice"}
                    foodReference={row.foodReference}
                    onPortionDraft={amount=>patch(row.id,{amount,carbohydrate:'',protein:'',fat:'',fiber:''})}
                    engine={engine === 'physiology' ? 'physiology' : 'conditional'}
                    disabled={disabled}
                    onSelectFood={(foodName, portionGrams, carbsGrams, reference) => {
                      patch(row.id, {
                        description: foodName,
                        amount: String(portionGrams),
                        carbohydrate: String(carbsGrams),
                        carbohydrateSource: reference?'food-composition':'manual',foodReference:reference,
                        ...referenceMacros(reference,portionGrams),
                      });
                    }}
                    onUpdatePortion={(portionGrams, carbsGrams, reference) => {
                      patch(row.id, {
                        amount: String(portionGrams),
                        carbohydrate: String(carbsGrams),
                        carbohydrateSource: reference?'food-composition':'manual',foodReference:reference,
                        ...referenceMacros(reference,portionGrams),
                      });
                    }}
                    onUpdateCarbs={(carbsGrams) => {
                      patch(row.id, {
                        carbohydrate: String(carbsGrams),
                        carbohydrateSource: "manual",
                        foodReference:undefined,
                      });
                    }}
                  />
                  {['auxiliary','integrated'].includes(engine) && <details className="rounded-xl bg-slate-50 p-3" open={engine==='auxiliary'}><summary className="cursor-pointer text-xs font-semibold text-slate-600">Meal nutrients <span className="font-normal">(optional)</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{(['protein','fat','fiber'] as const).map(nutrient=><label key={nutrient} className="block text-[11px] text-slate-500">{nutrient === 'fiber' ? 'Fiber' : nutrient === 'fat' ? 'Fat' : 'Protein'} (g)<input aria-label={`Event ${index+1} ${nutrient}`} required={engine==='auxiliary'} type="number" min={0} max={nutrient==='fiber'?40:100} step={0.1} value={row[nutrient]??''} placeholder={engine==='auxiliary'?"Enter amount or 0":"Unknown"} className={input} onChange={e=>patch(row.id,{[nutrient]:e.target.value})}/></label>)}</div></details>}
                  {engine === 'physiology' && (
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
                        <option value="25">Faster (e.g. a sugary drink)</option>
                        <option value="45">Typical (mixed meal)</option>
                        <option value="75">
                          Slower (mixed meal with fat / fibre)
                        </option>
                      </select>
                      <span className="mt-1 block text-[10px]">
                        Illustrative timing assumption, not a food-specific
                        measured response.
                      </span>
                    </label>
                  )}
                </>
              )}
              {row.kind === 'activity' && engine === 'auxiliary' && <label className="block text-[11px] text-slate-500">Activity intensity (MET)<input aria-label={`Event ${index+1} MET`} required type="number" min={1} max={8} step={0.1} className={input} value={row.met??''} placeholder="e.g. 3" onChange={e=>patch(row.id,{met:e.target.value})}/><span className="mt-1 block text-[10px]">Use a 15-minute start/duration grid. Overlapping activities are not supported.</span></label>}
              {row.kind === "activity" && engine === 'physiology' && (
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
                      Moderate aerobic (e.g. walking)
                    </option>
                    <option value="intense">
                      Intense (possible stress-related rise)
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
                engine !== 'physiology' ? <p className="text-[10px] leading-relaxed text-slate-500">Selected formulation: {row.insulinFormulation==='regular'?'Regular':'Rapid analogue'}. Estimated IOB is recalculated from dose and time.</p> : <p className="text-[10px] leading-relaxed text-slate-400">
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
        {engine === 'integrated' ? 'Up to 12 meal, bolus and physical activity events share one v3 decoder. Meal composition is optional: enter all three values or leave all unknown. Run again after changes.' : engine === 'auxiliary' ? 'Up to 12 meal/activity events. Each event enters the trained CGMacros decoder. Missing future activity remains unknown; insulin and other medicines are outside this model.' : engine === 'conditional' ? 'Up to 12 events. Both curves use the saved v3 decoder and the same observed history. Unrecorded future intake/exposure is unknown. Exercise and other medicine effects are not trained inputs.' : 'Up to 12 events. Changes are drafts until you run the simulation. Meals, rapid insulin and activity use an unvalidated physiology model, not a treatment prediction.'}
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
        disabled={disabled}
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
