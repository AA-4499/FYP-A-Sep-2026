import { PhysiologyLab } from "./PhysiologyLab";
import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  AlertCircle,
  SlidersHorizontal,
  Database,
  Download,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { Patient, NavigationModule } from "../types";
import {
  fetchGlucoseForecast,
  getForecastApiUrl,
  saveForecastApiUrl,
  type ForecastSource,
  type ForecastPoint,
  type ForecastEvent,
  type GlucoseForecast,
} from "../lib/forecast";

type Props = {
  patient: Patient;
  onNavigate: (module: NavigationModule) => void;
};
type Series = {
  key: string;
  label: string;
  color: string;
  points: ForecastPoint[];
};
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const input =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const timestamp = (value: string) =>
  Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
const formatTime = (value: number) =>
  new Date(value).toISOString().slice(5, 16).replace("T", " ");
const displayTime = (value?: string) =>
  value ? value.replace("T", " ").slice(0, 16) : "Awaiting data";
const displayNumber = (value?: number, digits = 1) =>
  value === undefined ? "\u2014" : value.toFixed(digits);

function chartRows(series: Series[]) {
  const rows = new Map<number, Record<string, number>>();
  series.forEach(({ key, points }) =>
    points.forEach((point) => {
      const time = timestamp(point.timestamp);
      if (!Number.isFinite(time)) return;
      const row = rows.get(time) || { timestamp: time };
      row[key] = point.value;
      rows.set(time, row);
    }),
  );
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function GlucoseChart({
  series,
  loading,
  history = false,
}: {
  series: Series[];
  loading: boolean;
  history?: boolean;
}) {
  const [fitForecast, setFitForecast] = useState(true);
  const rows = chartRows(series);
  const hasData = rows.length > 0;
  let minimum = Infinity,
    maximum = -Infinity;
  series.forEach((s) =>
    s.points.forEach((point) => {
      if (Number.isFinite(point.value)) {
        minimum = Math.min(minimum, point.value);
        maximum = Math.max(maximum, point.value);
      }
    }),
  );
  const padding = Math.max(5, (maximum - minimum) * 0.15);
  const focused = !history && fitForecast && Number.isFinite(minimum);
  const domain: [number | string, number | string] = !hasData
    ? [40, 280]
    : history
      ? ["auto", "auto"]
      : focused
        ? [Math.floor(minimum - padding), Math.ceil(maximum + padding)]
        : [Math.min(40, minimum), Math.max(280, maximum)];
  return (
    <>
      {!history && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            {focused
              ? "Y-axis fitted to the predicted values · mg/dL"
              : "Reference-range view · mg/dL"}
          </p>
          <button
            type="button"
            aria-label="Fit forecast vertical range"
            aria-pressed={fitForecast}
            onClick={() => setFitForecast((value) => !value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            {fitForecast ? "Show reference range" : "Fit forecast range"}
          </button>
        </div>
      )}
      <div
        className="relative mt-5 h-[330px] w-full"
        role="img"
        data-scale={focused ? "fit" : "reference"}
        aria-label={
          history
            ? "Observed CGM with training, validation, and held-out testing predictions"
            : "Baseline and what-if glucose prediction comparison"
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 15, right: 15, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={hasData ? ["dataMin", "dataMax"] : [0, 1]}
              scale="time"
              tickFormatter={hasData ? formatTime : () => ""}
              minTickGap={50}
              tick={{ fontSize: 10 }}
            />
            <YAxis domain={domain} tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              labelFormatter={(value) => formatTime(Number(value))}
              formatter={(value: unknown) =>
                `${Number(value).toFixed(1)} mg/dL`
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
            {[
              { value: 70, color: "#c2410c" },
              { value: 140, color: "#16a34a" },
              { value: 180, color: "#ca8a04" },
              { value: 250, color: "#dc2626" },
            ].map((line) => (
              <ReferenceLine
                key={line.value}
                y={line.value}
                ifOverflow={history ? "extendDomain" : "discard"}
                stroke={line.color}
                strokeDasharray="4 4"
                label={{
                  value: String(line.value),
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: line.color,
                }}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.key}
                type="linear"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.key === "observed" ? 1 : 2}
                strokeDasharray={s.key === "scenario" ? "6 3" : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-x-10 top-20 flex justify-center pointer-events-none">
            <div className="max-w-xs rounded-xl border border-slate-200 bg-white/95 p-4 text-center shadow-sm">
              {loading && (
                <RefreshCw
                  size={18}
                  className="mx-auto mb-2 animate-spin text-blue-500"
                />
              )}
              <p className="text-sm font-semibold text-slate-700">
                {loading
                  ? "Loading model results"
                  : "Waiting for model results"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {history
                  ? "Observed CGM and training, validation and testing curves will appear here."
                  : "The baseline forecast and applied what-if scenario will appear here."}
              </p>
            </div>
          </div>
        )}
      </div>
      {!history && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          Axis zoom changes the display only. All curve values are unchanged
          model outputs; reference lines outside the visible range are hidden.
        </p>
      )}
    </>
  );
}

function ForecastPanel({
  patient,
  onNavigate,
  onOpenPhysiology,
}: Props & { onOpenPhysiology: () => void }) {
  const [source, setSource] = useState<ForecastSource>("browser");
  const preview = source === "preview";
  const browser = source === "browser";
  const [horizon, setHorizon] = useState(6);
  const [mealEnabled, setMealEnabled] = useState(false);
  const [insulinEnabled, setInsulinEnabled] = useState(false);
  const [mealAmount, setMealAmount] = useState(60);
  const [insulinAmount, setInsulinAmount] = useState(2);
  const [mealMinutes, setMealMinutes] = useState(60);
  const [insulinMinutes, setInsulinMinutes] = useState(120);
  const [request, setRequest] = useState<{
    revision: number;
    events: ForecastEvent[];
    runId: string;
  }>(() => ({ revision: 0, events: [], runId: crypto.randomUUID() }));
  const [result, setResult] = useState<GlucoseForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(getForecastApiUrl);
  const [connectionError, setConnectionError] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const current =
    result?.patient_id === patient.id &&
    result.source === source &&
    result.horizon_hours === horizon
      ? result
      : null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchGlucoseForecast(
      patient.id,
      {
        source,
        horizon_hours: horizon,
        events: request.events,
        run_id: request.runId,
      },
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Forecast unavailable.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [patient.id, source, horizon, request]);

  function baselineRequest() {
    setRequest((previous) => ({
      revision: previous.revision + 1,
      events: [],
      runId: crypto.randomUUID(),
    }));
  }

  function run(event: React.FormEvent) {
    event.preventDefault();
    const events: ForecastEvent[] = [];
    if (mealEnabled)
      events.push({
        kind: "meal",
        amount: mealAmount,
        minutes_ahead: mealMinutes,
      });
    if (insulinEnabled)
      events.push({
        kind: "insulin",
        amount: insulinAmount,
        minutes_ahead: insulinMinutes,
      });
    setRequest((previous) => ({
      revision: previous.revision + 1,
      events,
      runId: crypto.randomUUID(),
    }));
  }

  function connect(event: React.FormEvent) {
    event.preventDefault();
    try {
      saveForecastApiUrl(apiUrl);
      setConnectionError("");
      setConnectionOpen(false);
      setSource("supabase");
      setMealEnabled(false);
      setInsulinEnabled(false);
      baselineRequest();
    } catch (err) {
      setConnectionError(
        err instanceof Error
          ? err.message
          : "Enter a valid model service address.",
      );
    }
  }

  function download() {
    if (!current) return;
    const lines = [
      "timestamp,baseline_glucose_mg_dl,scenario_glucose_mg_dl",
      ...current.baseline.map(
        (point, index) =>
          `${point.timestamp},${point.value},${current.scenario[index]?.value ?? ""}`,
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `glucose-forecast-${current.patient_id}-${current.horizon_hours}h.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const forecastSeries: Series[] = [
    {
      key: "baseline",
      label: "Baseline prediction",
      color: "#2563eb",
      points: current?.baseline ?? [],
    },
    ...(current?.scenario_enabled || !current
      ? [
          {
            key: "scenario",
            label: "What-if prediction",
            color: "#e07a36",
            points: current?.scenario ?? [],
          },
        ]
      : []),
  ];
  const historySeries: Series[] = [
    {
      key: "observed",
      label: "Observed CGM",
      color: "#cbd5e1",
      points: current?.observed ?? [],
    },
    {
      key: "training",
      label: "Training prediction",
      color: "#53b5a8",
      points: current?.training ?? [],
    },
    {
      key: "validation",
      label: "Validation prediction",
      color: "#f59e0b",
      points: current?.validation ?? [],
    },
    {
      key: "testing",
      label: "Testing prediction",
      color: "#596caa",
      points: current?.testing ?? [],
    },
    {
      key: "actual",
      label: "Real testing CGM",
      color: "#8b5cf6",
      points: current?.testing_actual ?? [],
    },
  ];
  const delta = current
    ? current.scenario_end - current.baseline_end
    : undefined;
  const differences = current?.scenario_enabled
    ? current.scenario.map(
        (point, index) =>
          point.value - (current.baseline[index]?.value ?? point.value),
      )
    : [];
  const peakDifference = differences.reduce(
    (peak, value) => (Math.abs(value) > Math.abs(peak) ? value : peak),
    0,
  );
  const forecastRows = current?.baseline.slice(1) ?? [];

  return (
    <div className="space-y-5 pb-10 animate-fadeIn">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            onClick={() => onNavigate("patient_dashboard")}
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft size={14} />
            Back to Patient Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            Risk Prediction and What-if Simulation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Shanghai T2DM CGM forecasting &middot; Patient record {patient.id}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConnectionOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Settings2 size={14} />
          {browser ? "Online service (optional)" : "Service connection"}
        </button>
      </header>

      {preview && (
        <div
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
          data-testid="preview-notice"
        >
          <p className="font-semibold">Local data preview</p>
          <p className="mt-1 text-xs leading-relaxed">
            Charts use precomputed predictions from the local Excel records and
            the saved GRU model. No Python service is required. These results do
            not update from Supabase and are not saved to Supabase. Choose
            Repository GRU or the online service to calculate new what-if
            scenarios.
          </p>
          {current?.generated_at && (
            <p className="mt-2 text-xs">
              Snapshot generated: {displayTime(current.generated_at)} UTC
            </p>
          )}
        </div>
      )}
      {browser && (
        <div
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"
          data-testid="browser-model-notice"
        >
          <p className="font-semibold">Repository GRU · runs in your browser</p>
          <p className="mt-1 text-xs leading-relaxed">
            Uses the trained model and this exact record's history bundled from
            the GitHub repository. Forecasts and what-if events are calculated
            here without Render or sign-in. This is repository workbook history,
            not refreshed Supabase observations. Results are not saved to the
            database.
          </p>
          <p className="mt-2 text-[11px]">
            The historical evaluation charts are checkpoint-matched saved
            diagnostics; the forecast and scenario curves are newly computed.
          </p>
        </div>
      )}

      {connectionOpen && (
        <form onSubmit={connect} className={`${card} space-y-3`}>
          <h2 className="text-sm font-semibold">
            Connect the prediction service
          </h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Enter the public address of the Python service that runs the GRU
            model. This is separate from your Supabase project and your Vercel
            webpage.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-medium text-slate-600">
              Model service URL
              <input
                className={input}
                type="url"
                placeholder="https://your-model-service.onrender.com"
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Connect and retry
            </button>
          </div>
          <p className="text-xs text-slate-400">
            This address is saved only in this browser. Leave blank to use the
            deployment configuration.
          </p>
          {connectionError && (
            <p role="alert" className="text-xs text-red-700">
              {connectionError}
            </p>
          )}
        </form>
      )}

      <div className={`${card} flex flex-wrap items-center gap-4 !py-3`}>
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Activity size={17} className="text-blue-600" />
          Forecast settings
        </span>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Execution / data source
          <select
            aria-label="Data source"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as ForecastSource);
              setMealEnabled(false);
              setInsulinEnabled(false);
              baselineRequest();
            }}
          >
            <option value="browser">
              Repository GRU · browser (no Render)
            </option>
            <option value="supabase">Supabase Cloud (online service)</option>
            {patient.dataSource !== "supabase" && (
              <>
                <option value="preview">Local data preview (no server)</option>
                <option value="local">Local Excel (online service)</option>
              </>
            )}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Forecast horizon
          <select
            aria-label="Forecast horizon"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
            value={horizon}
            onChange={(event) => {
              const hours = Number(event.target.value);
              setHorizon(hours);
              setMealMinutes((value) => Math.min(value, hours * 60 - 15));
              setInsulinMinutes((value) => Math.min(value, hours * 60 - 15));
              baselineRequest();
            }}
          >
            {[6, 12].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400 sm:ml-auto">
          15-minute forecast intervals
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            browser ? "Latest repository CGM" : "Latest observed CGM",
            current
              ? `${displayNumber(current.latest_glucose)} mg/dL`
              : "\u2014",
          ],
          [
            "Held-out one-step MAE",
            current?.metrics
              ? `${displayNumber(current.metrics.mae_mg_dl)} mg/dL`
              : "\u2014",
          ],
          [
            `Prediction after ${horizon} hours`,
            current ? `${displayNumber(current.scenario_end)} mg/dL` : "\u2014",
          ],
          [
            "What-if at forecast end",
            delta !== undefined && current?.scenario_enabled
              ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} mg/dL`
              : current
                ? "No event applied"
                : "\u2014",
          ],
        ].map(([label, value]) => (
          <div key={label} className={`${card} !p-4`}>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0 space-y-5" aria-busy={loading}>
          <div aria-live="polite">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Prediction results are unavailable
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{error}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
                    <button
                      onClick={() =>
                        setRequest((previous) => ({
                          ...previous,
                          revision: previous.revision + 1,
                        }))
                      }
                      className="underline"
                    >
                      Retry same forecast
                    </button>
                    <button
                      onClick={() => setConnectionOpen(true)}
                      className="underline"
                    >
                      Check service connection
                    </button>
                    {!browser && (
                      <button
                        onClick={() => {
                          setSource("browser");
                          setMealEnabled(false);
                          setInsulinEnabled(false);
                          baselineRequest();
                        }}
                        className="underline"
                      >
                        Use repository model without Render
                      </button>
                    )}
                  </div>
                  {current && (
                    <p className="mt-2 text-xs">
                      The charts below show the last completed forecast.
                    </p>
                  )}
                </div>
              </div>
            )}
            {loading && (
              <p className="flex items-center gap-2 text-xs text-blue-600">
                <RefreshCw size={14} className="animate-spin" />
                {preview
                  ? "Loading local chart snapshot..."
                  : browser
                    ? "Running the repository GRU in a background worker..."
                    : current
                      ? "Updating forecast; showing the last completed result."
                      : "Loading CGM history and running the GRU model..."}
              </p>
            )}
            {!loading && !error && current && (
              <p className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 size={14} />
                {preview
                  ? "Local snapshot loaded; no database write"
                  : browser
                    ? "Browser GRU computed successfully; no database write"
                    : current.storage?.saved
                      ? `Saved to Supabase · ${current.storage.test_predictions_saved} held-out predictions and full forecast curves`
                      : "Forecast loaded; no storage receipt"}
              </p>
            )}
          </div>

          <section className={card} data-testid="prediction-panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Glucose prediction
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {horizon}-hour{" "}
                  {preview
                    ? "precomputed baseline forecast"
                    : "baseline and what-if comparison"}
                </p>
              </div>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
                CGM &middot; mg/dL
              </span>
            </div>
            <GlucoseChart series={forecastSeries} loading={loading} />
            <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-4 text-xs leading-relaxed text-slate-600">
              <p>
                The GRU estimates a statistical trajectory from recent history.
                Recursive predictions can settle towards a stable value; a
                longer horizon does not guarantee a rise and fall. Added events
                show this model's learned sensitivity, not a validated
                physiological response.
              </p>
              <button
                type="button"
                onClick={onOpenPhysiology}
                className="mt-3 font-semibold text-teal-800 hover:underline"
              >
                Explore meal absorption and delayed insulin feedback →
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {current
                ? `Forecast begins ${displayTime(current.forecast_start)}. Future points use recursive 15-minute predictions.`
                : browser
                  ? "Loading the model and exact repository record history."
                  : "Connect the prediction service to load the selected patient's model results."}
            </p>
          </section>

          <section className={card} data-testid="forecast-values-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Forecast values
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Predicted CGM at each future 15-minute step
                </p>
              </div>
              <button
                disabled={!current}
                onClick={download}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600 disabled:opacity-40"
              >
                <Download size={14} />
                CSV
              </button>
            </div>
            {forecastRows.length ? (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 font-medium">Timestamp</th>
                        <th className="py-2 font-medium">Baseline</th>
                        <th className="py-2 font-medium">What-if</th>
                        <th className="py-2 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllRows
                        ? forecastRows
                        : forecastRows.slice(0, 12)
                      ).map((point, index) => {
                        const scenario = current!.scenario[index + 1]?.value;
                        const change =
                          scenario === undefined
                            ? undefined
                            : scenario - point.value;
                        return (
                          <tr
                            key={point.timestamp}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="whitespace-nowrap py-2.5 pr-3">
                              {displayTime(point.timestamp)}
                            </td>
                            <td className="py-2.5">
                              {point.value.toFixed(1)} mg/dL
                            </td>
                            <td className="py-2.5">
                              {current!.scenario_enabled
                                ? `${displayNumber(scenario)} mg/dL`
                                : "\u2014"}
                            </td>
                            <td className="py-2.5">
                              {current!.scenario_enabled && change !== undefined
                                ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}`
                                : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {forecastRows.length > 12 && (
                  <button
                    className="mt-3 text-xs font-semibold text-blue-600"
                    onClick={() => setShowAllRows((show) => !show)}
                  >
                    {showAllRows
                      ? "Show first 12 rows"
                      : `Show all ${forecastRows.length} forecast rows`}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                Forecast values will appear after the model returns a result.
              </p>
            )}
          </section>
        </div>

        <aside
          className={`${card} xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto`}
          data-testid="simulator-panel"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <SlidersHorizontal size={17} className="text-blue-600" />
            What-if simulator
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {preview
              ? "This static preview cannot calculate new scenarios. Choose Repository GRU or the online service."
              : "Add hypothetical events to compare their projected effect with the baseline prediction."}
          </p>
          {current?.scenario_enabled && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs">
              <p className="text-slate-600">Largest curve difference</p>
              <p className="mt-1 font-semibold text-blue-800">
                {Math.abs(peakDifference).toFixed(2)} mg/dL
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                At the forecast end:{" "}
                {delta !== undefined && delta >= 0 ? "+" : ""}
                {delta?.toFixed(2)} mg/dL. Earlier changes can disappear before
                the final step.
              </p>
            </div>
          )}
          <form onSubmit={run} className="mt-5 space-y-5">
            <fieldset
              disabled={preview}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 disabled:opacity-50"
            >
              <legend className="px-1 text-xs font-semibold text-slate-700">
                Meal event
              </legend>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={mealEnabled}
                  onChange={(event) => setMealEnabled(event.target.checked)}
                />
                Include a meal event
              </label>
              <label className="block text-xs text-slate-500">
                Food mass (g)
                <input
                  className={input}
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  disabled={!mealEnabled}
                  value={mealAmount}
                  onChange={(event) =>
                    setMealAmount(event.target.valueAsNumber)
                  }
                />
              </label>
              <label className="block text-xs text-slate-500">
                Minutes after latest CGM
                <input
                  className={input}
                  type="number"
                  min="15"
                  max={horizon * 60 - 15}
                  step="15"
                  required
                  disabled={!mealEnabled}
                  value={mealMinutes}
                  onChange={(event) =>
                    setMealMinutes(event.target.valueAsNumber)
                  }
                />
              </label>
            </fieldset>
            <fieldset
              disabled={preview}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 disabled:opacity-50"
            >
              <legend className="px-1 text-xs font-semibold text-slate-700">
                Insulin event
              </legend>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={insulinEnabled}
                  onChange={(event) => setInsulinEnabled(event.target.checked)}
                />
                Include an insulin event
              </label>
              <label className="block text-xs text-slate-500">
                Insulin amount (units)
                <input
                  className={input}
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  disabled={!insulinEnabled}
                  value={insulinAmount}
                  onChange={(event) =>
                    setInsulinAmount(event.target.valueAsNumber)
                  }
                />
              </label>
              <label className="block text-xs text-slate-500">
                Minutes after latest CGM
                <input
                  className={input}
                  type="number"
                  min="15"
                  max={horizon * 60 - 15}
                  step="15"
                  required
                  disabled={!insulinEnabled}
                  value={insulinMinutes}
                  onChange={(event) =>
                    setInsulinMinutes(event.target.valueAsNumber)
                  }
                />
              </label>
            </fieldset>
            <p className="text-[11px] leading-relaxed text-slate-400">
              {preview
                ? "The static preview contains baseline results only. Choose Repository GRU or the online service for new scenarios."
                : `Use 15-minute intervals within the selected ${horizon}-hour horizon. Changes apply when you run the simulation.`}
            </p>
            <button
              type="submit"
              disabled={loading || preview}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {preview
                ? "Online service required"
                : loading
                  ? "Running model..."
                  : "Run what-if simulation"}
            </button>
            <button
              type="button"
              className="w-full text-xs font-medium text-slate-500 hover:text-blue-600"
              onClick={() => {
                setMealEnabled(false);
                setInsulinEnabled(false);
                baselineRequest();
              }}
            >
              Reset to baseline
            </button>
            <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
              Baseline means no future events were supplied, not confirmed
              fasting or no insulin. Food mass is not carbohydrate mass. These
              curves show model sensitivity, not validated treatment effects.{" "}
              {preview
                ? "Local previews are not saved to Supabase."
                : browser
                  ? "Browser GRU forecasts are not saved to Supabase."
                  : "Completed online forecasts are saved to Supabase."}
            </p>
          </form>
        </aside>
      </div>
      <details
        className={card}
        data-testid="history-panel"
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-bold text-slate-900">
          CGM training, validation and testing history
          <span className="ml-2 text-xs font-normal text-slate-400">
            Historical diagnostics · expand to view
          </span>
        </summary>
        {historyOpen && (
          <div className="mt-5 space-y-5">
            <section className="space-y-3" data-testid="history-content">
              <h2 className="text-sm font-bold text-slate-900">
                CGM training, validation and testing history
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Observed readings and chronological GRU predictions for the
                selected patient record
              </p>
              <GlucoseChart series={historySeries} loading={loading} history />
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Training and validation curves are in-sample diagnostics.
                Testing shows rolling one-step predictions against actual
                held-out CGM readings. These errors do not validate the accuracy
                of a 6- or 12-hour recursive forecast.
              </p>
            </section>
            <section className={card} data-testid="evaluation-panel">
              <h2 className="text-sm font-bold text-slate-900">
                Model evaluation and timeline coverage
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [
                    "One-step MAE",
                    current?.metrics
                      ? `${current.metrics.mae_mg_dl.toFixed(2)} mg/dL`
                      : "\u2014",
                  ],
                  [
                    "One-step RMSE",
                    current?.metrics
                      ? `${current.metrics.rmse_mg_dl.toFixed(2)} mg/dL`
                      : "\u2014",
                  ],
                  [
                    "Test windows",
                    current?.metrics?.test_windows.toLocaleString() ?? "\u2014",
                  ],
                  [
                    "Model lookback",
                    current ? `${current.sequence_length * 15} min` : "\u2014",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Timeline</th>
                      <th className="py-2 font-medium">Points</th>
                      <th className="py-2 font-medium">Start</th>
                      <th className="py-2 font-medium">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySeries
                      .filter((series) => series.key !== "actual")
                      .map((series) => (
                        <tr
                          key={series.key}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-3">
                            <span
                              className="mr-2 inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: series.color }}
                            />
                            {series.label}
                          </td>
                          <td className="py-3 pr-3">
                            {current ? series.points.length : "\u2014"}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3">
                            {displayTime(series.points[0]?.timestamp)}
                          </td>
                          <td className="whitespace-nowrap py-3">
                            {displayTime(
                              series.points[series.points.length - 1]
                                ?.timestamp,
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>{" "}
            <section className={card} data-testid="model-details-panel">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Database size={15} className="text-blue-500" />
                Model and data details
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                {[
                  ["Model", "One-step GRU (legacy)"],
                  ["Patient record", patient.id],
                  [
                    "Execution",
                    browser
                      ? "Browser GRU · no Render"
                      : (current?.source ?? source),
                  ],
                  [
                    "Input history",
                    browser
                      ? "Exact repository workbook record (not live Supabase)"
                      : "Selected service data source",
                  ],
                  [
                    "Checkpoint SHA-256",
                    current?.model_sha256 ?? "Awaiting model",
                  ],
                  [
                    "Observed readings",
                    current?.observed.length.toLocaleString() ?? "\u2014",
                  ],
                  [
                    "Model lookback",
                    current
                      ? `${current.sequence_length} readings / ${current.sequence_length * 15} minutes`
                      : "\u2014",
                  ],
                  ["Forecast begins", displayTime(current?.forecast_start)],
                  [
                    "Supabase run ID",
                    preview || browser
                      ? "Not saved (local browser session)"
                      : (current?.storage?.run_id ?? "No completed run"),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="mt-1 break-all font-medium text-slate-700">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
                Research and education only; not for diagnosis, treatment, or
                insulin dosing. Meal and insulin effects are learned from sparse
                historical events. Reference lines are shown at 70, 140, 180 and
                250 mg/dL.
              </p>
            </section>
          </div>
        )}
      </details>
    </div>
  );
}

export const RiskSimulationView: React.FC<Props> = (props) => {
  const [tab, setTab] = useState<"forecast" | "physiology">("forecast");
  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2"
        role="tablist"
        aria-label="Prediction workspace"
      >
        {(
          [
            ["forecast", "CGM forecast"],
            ["physiology", "Physiology lab"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-5 py-3 text-xs font-bold transition ${tab === id ? "bg-teal-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "forecast" ? (
        <ForecastPanel
          key={props.patient.id}
          {...props}
          onOpenPhysiology={() => setTab("physiology")}
        />
      ) : (
        <PhysiologyLab key={props.patient.id} patient={props.patient} />
      )}
    </div>
  );
};
