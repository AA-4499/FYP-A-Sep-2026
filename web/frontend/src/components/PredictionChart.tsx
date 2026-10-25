import React, { useEffect, useId, useMemo, useState } from "react";
import {
  Layers,
  SlidersHorizontal,
  MoveHorizontal,
  ArrowUpRight,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "../lib/forecast";
import type { RangeEnvelope } from "../lib/forecastRanges";
import {
  glucoseAxisScale,
  glucoseGradientStops,
  glucoseReferenceZones,
  rangeAverage,
} from "../lib/glucoseRangeDisplay";

export interface PredictionChartSeries {
  key: string;
  label: string;
  color: string;
  points: ForecastPoint[];
  range?: RangeEnvelope | null;
}
const instant = (value: string) =>
  Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
const clock = (value: number) => new Date(value).toISOString().slice(11, 16);
type ChartRow = { timestamp: number; [key: string]: number | [number, number] };
function ReadoutProbe({
  active,
  label,
  onChange,
}: {
  active?: boolean;
  label?: unknown;
  onChange: (time: number | null) => void;
}) {
  useEffect(() => {
    onChange(active && Number.isFinite(Number(label)) ? Number(label) : null);
  }, [active, label, onChange]);
  return null;
}

/** Display-only forecast chart: bounds and midpoint calculations are unchanged. */
export function PredictionChart({
  series,
  loading,
}: {
  series: PredictionChartSeries[];
  loading: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [focused, setFocused] = useState(true),
    [modelOnly, setModelOnly] = useState(false),
    [innerOpen, setInnerOpen] = useState(false);
  const [inspectTime, setInspectTime] = useState<number | null>(null);
  const hasRanges = series.some((item) => !!item.range?.points.length);
  const rows = useMemo(() => {
    const map = new Map<number, ChartRow>();
    for (const item of series) {
      for (const point of item.points) {
        const time = instant(point.timestamp);
        if (!Number.isFinite(time) || !Number.isFinite(point.value)) continue;
        const row = map.get(time) || { timestamp: time };
        row[item.key] = point.value;
        map.set(time, row);
      }
      for (const point of item.range?.points || []) {
        const row = map.get(instant(point.timestamp));
        if (row) {
          row[`${item.key}_outer`] = point.outer;
          row[`${item.key}_inner`] = point.inner;
          row[`${item.key}_average`] = rangeAverage(point.outer);
        }
      }
    }
    return [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
  }, [series]);
  const bounds = series
    .flatMap((item) => [
      ...item.points.map((point) => point.value),
      ...(!modelOnly
        ? item.range?.points.flatMap((point) => point.outer) || []
        : []),
    ])
    .filter(Number.isFinite);
  const scale = glucoseAxisScale(
    bounds.length ? Math.min(...bounds) : NaN,
    bounds.length ? Math.max(...bounds) : NaN,
    focused,
  );
  const first = rows[0],
    last = rows[rows.length - 1];
  const selected = rows.find((row) => row.timestamp === inspectTime) || last;
  const hours =
    first && last ? (last.timestamp - first.timestamp) / 3600000 : 6;
  const step = hours > 6 ? 2 : 1;
  const timeTicks = first
    ? Array.from(
        { length: Math.floor(hours / step) + 1 },
        (_, index) => first.timestamp + index * step * 3600000,
      )
    : [];
  const shown = (item: PredictionChartSeries) =>
    !modelOnly && item.range ? `${item.key}_average` : item.key;

  return (
    <div className="mt-5 text-black" data-testid="forecast-chart-design">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2"
          data-testid="prediction-layer-legend"
        >
          {series.map((item) => (
            <span
              key={item.key}
              className="inline-flex items-center gap-2 text-xs font-medium text-black"
            >
              <svg width="22" height="10" aria-hidden="true">
                <line
                  x1="0"
                  x2="22"
                  y1="5"
                  y2="5"
                  stroke={item.color}
                  strokeWidth="2.5"
                  strokeDasharray={item.key === "scenario" ? "5 3" : undefined}
                />
              </svg>
              {item.key === "scenario" ? "What-if" : "Baseline"}{" "}
              {!modelOnly && item.range ? "average" : "estimate"}
            </span>
          ))}
          {hasRanges && !modelOnly && (
            <span className="inline-flex items-center gap-2 text-xs text-black">
              <span className="h-3 w-5 rounded border border-emerald-200 bg-emerald-50" />
              Outer range
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1">
          {hasRanges && (
            <button
              type="button"
              onClick={() => setModelOnly((value) => !value)}
              aria-pressed={!modelOnly}
              className="rounded-lg px-2.5 py-2 text-[11px] font-medium text-black transition hover:bg-white hover:shadow-sm"
            >
              {modelOnly ? "Show range bands" : "Show model estimates only"}
            </button>
          )}
          <button
            type="button"
            aria-label="Fit forecast vertical range"
            aria-pressed={focused}
            onClick={() => setFocused((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-medium text-black transition hover:bg-white hover:shadow-sm"
          >
            <SlidersHorizontal size={12} />
            {focused ? "Show reference range" : "Fit forecast range"}
          </button>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-black">
        <span>Glucose · mg/dL</span>
        <span>
          {first
            ? new Date(first.timestamp).toISOString().slice(0, 10)
            : "Forecast"}{" "}
          · UTC
        </span>
      </div>
      <div
        role="img"
        aria-label="Baseline and what-if glucose prediction comparison"
        data-scale={focused ? "fit" : "reference"}
        data-display={hasRanges && !modelOnly ? "range" : "point"}
        className="relative mt-2 h-[310px] w-full min-w-0 sm:h-[370px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 20, right: 14, left: -10, bottom: 6 }}
          >
            <defs>
              {series
                .filter((item) => item.range)
                .flatMap((item) =>
                  (["outer", "inner"] as const).map((band) => (
                    <linearGradient
                      key={`${item.key}-${band}`}
                      id={`${id}-${item.key}-${band}`}
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      {glucoseGradientStops(
                        item.range!.points.map((point) => point[band]),
                        band === "inner",
                      ).map((stop, index) => (
                        <stop
                          key={index}
                          offset={stop.offset}
                          stopColor={stop.color}
                        />
                      ))}
                    </linearGradient>
                  )),
                )}
            </defs>
            <CartesianGrid vertical stroke="#cbd5e1" strokeDasharray="2 5" />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={
                first && last ? [first.timestamp, last.timestamp] : [0, 1]
              }
              ticks={timeTicks}
              minTickGap={32}
              tickMargin={14}
              tickFormatter={(value) => (first ? clock(Number(value)) : "")}
              tick={{ fontSize: 11, fill: "#000000" }}
              axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
              tickLine={{ stroke: "#000000", strokeWidth: 1 }}
            />
            <YAxis
              domain={scale.domain}
              ticks={scale.ticks}
              width={55}
              allowDecimals={false}
              tickFormatter={(value) => String(Math.round(Number(value)))}
              tick={{ fontSize: 11, fill: "#000000" }}
              axisLine={{ stroke: "#000000", strokeWidth: 1.5 }}
              tickLine={{ stroke: "#000000", strokeWidth: 1 }}
            />
            <Tooltip
              cursor={{
                stroke: "#000000",
                strokeDasharray: "3 5",
                strokeWidth: 1,
              }}
              content={(props) => (
                <ReadoutProbe
                  active={props.active}
                  label={props.label}
                  onChange={setInspectTime}
                />
              )}
            />
            {!modelOnly &&
              series
                .filter((item) => item.range)
                .map((item) => (
                  <React.Fragment key={item.key}>
                    <Area
                      type="linear"
                      dataKey={`${item.key}_outer`}
                      name={`${item.key} outer range`}
                      fill={`url(#${id}-${item.key}-outer)`}
                      fillOpacity={0.19}
                      stroke={`url(#${id}-${item.key}-outer)`}
                      strokeOpacity={0.65}
                      strokeWidth={1}
                      strokeDasharray={
                        item.key === "baseline" ? "3 4" : undefined
                      }
                      activeDot={false}
                      legendType="none"
                      isAnimationActive={false}
                    />
                    {innerOpen && (
                      <Area
                        type="linear"
                        dataKey={`${item.key}_inner`}
                        name={`${item.key} inner spread`}
                        fill={`url(#${id}-${item.key}-inner)`}
                        fillOpacity={0.3}
                        stroke="none"
                        activeDot={false}
                        legendType="none"
                        isAnimationActive={false}
                      />
                    )}
                  </React.Fragment>
                ))}
            {[
              { value: 54, color: "#C2410C", label: "Very low 54" },
              { value: 70, color: "#F97316", label: "Low 70" },
              { value: 180, color: "#DC2626", label: "High 180" },
              { value: 250, color: "#991B1B", label: "Very high 250" },
            ].map(({ value, color, label }) => (
              <ReferenceLine
                key={value}
                y={value}
                ifOverflow="discard"
                stroke={color}
                strokeWidth={2.2}
                strokeDasharray="1 6"
                strokeLinecap="round"
                label={{
                  value: label,
                  position: "insideTopRight",
                  fontSize: 10,
                  fontWeight: 600,
                  fill: "#000000",
                  stroke: "#ffffff",
                  strokeWidth: 3,
                  paintOrder: "stroke",
                }}
              />
            ))}
            {series.map((item) => (
              <Line
                key={item.key}
                type="linear"
                dataKey={shown(item)}
                name={`${item.key} average`}
                stroke={item.color}
                strokeWidth={2.8}
                strokeDasharray={item.key === "scenario" ? "7 4" : undefined}
                connectNulls
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: "white", strokeWidth: 2 }}
                dot={(props) => {
                  const row = props.payload as ChartRow | undefined;
                  return row && row.timestamp === last?.timestamp ? (
                    <circle
                      key={`${item.key}-end`}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={item.color}
                      stroke="white"
                      strokeWidth={2}
                    />
                  ) : (
                    <g key={`${item.key}-${row?.timestamp}`} />
                  );
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        {!rows.length && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="rounded-xl bg-white px-4 py-3 text-sm text-black">
              {loading
                ? "Preparing the forecast..."
                : "A forecast will appear here"}
            </p>
          </div>
        )}
      </div>
      {selected && (
        <div
          data-testid="prediction-chart-readout"
          className="mt-4 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 sm:flex sm:items-center sm:gap-8"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-black">
            <MoveHorizontal size={14} />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide">
                {inspectTime !== null ? "Inspecting" : "Forecast end"}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-black">
                {clock(selected.timestamp)}{" "}
                <span className="font-normal text-black">UTC</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:flex sm:flex-1 sm:gap-10">
            {series.map((item) => {
              const value = selected[shown(item)],
                bounds = selected[`${item.key}_outer`] as
                  [number, number] | undefined;
              return (
                <div key={item.key}>
                  <p className="text-[11px] text-black">
                    {item.key === "scenario" ? "What-if" : "Baseline"}{" "}
                    {!modelOnly && item.range ? "average" : "estimate"}
                  </p>
                  <p className="mt-0.5 text-lg font-semibold tracking-tight">
                    {typeof value === "number" ? value.toFixed(1) : "—"}
                    <span className="ml-1 text-[10px] font-normal tracking-normal text-black">
                      mg/dL
                    </span>
                  </p>
                  {!modelOnly && bounds && (
                    <p className="mt-0.5 text-[10px] text-black">
                      Range {bounds[0].toFixed(0)}–{bounds[1].toFixed(0)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3"
        data-testid="prediction-risk-legend"
      >
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {glucoseReferenceZones.map((zone) => (
            <span
              key={zone.label}
              className="inline-flex items-center gap-1.5 text-[10px] text-black"
            >
              <span
                className="h-0 w-5 border-t-2 border-dotted"
                style={{ borderColor: zone.color }}
              />
              {zone.label}
            </span>
          ))}
        </div>
        {hasRanges && !modelOnly && (
          <button
            type="button"
            aria-pressed={innerOpen}
            onClick={() => setInnerOpen((value) => !value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition ${innerOpen ? "bg-slate-100 text-black" : "text-black hover:bg-slate-50 hover:text-black"}`}
          >
            <Layers size={12} />
            {innerOpen ? "Hide inner spread" : "Show inner spread"}
          </button>
        )}
      </div>
      {innerOpen && !modelOnly && (
        <p
          className="mt-2 text-[10px] text-black"
          data-testid="inner-band-note"
        >
          Outer range: light fill. Inner spread: darker fill. The inner band is
          a central spread, not a confidence level.
        </p>
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-black">
        <ArrowUpRight size={12} className="mt-0.5 shrink-0" />
        {!modelOnly && hasRanges
          ? "Average line = midpoint of the outer bounds. Hover, tap or use the chart arrow keys to inspect a time point."
          : "Original centre estimates are shown."}{" "}
        Colours mark glucose levels, not risk probabilities.
      </p>
    </div>
  );
}
