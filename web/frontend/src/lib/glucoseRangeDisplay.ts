/** Display helpers only. These do not modify forecast bounds or claim risk probabilities. */
export const glucoseReferenceZones = [
  { label: "Very low <54", color: "#C2410C" },
  { label: "Low 54–<70", color: "#F97316" },
  { label: "Reference 70–180", color: "#86EFAC" },
  { label: "High >180–250", color: "#DC2626" },
  { label: "Very high >250", color: "#991B1B" },
] as const;
export function rangeAverage(bounds: [number, number]): number {
  return bounds[0] / 2 + bounds[1] / 2;
}
/** Rounded display domain/ticks only; all plotted data retain their original values. */
export function glucoseAxisScale(
  minimum: number,
  maximum: number,
  focused = true,
) {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    maximum < minimum
  )
    return {
      domain: [40, 300] as [number, number],
      ticks: [50, 100, 150, 200, 250, 300],
    };
  const padding = Math.max(5, (maximum - minimum) * 0.12);
  const low = focused
    ? minimum >= 0
      ? Math.max(0, minimum - padding)
      : minimum - padding
    : Math.min(40, minimum);
  const high = focused ? maximum + padding : Math.max(280, maximum);
  const rawStep = Math.max(1, (high - low) / 5),
    power = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    ([1, 2, 5, 10].find((multiplier) => multiplier * power >= rawStep) || 10) *
    power;
  const lower = Math.floor(low / step) * step,
    upper = Math.ceil(high / step) * step;
  return {
    domain: [lower, upper] as [number, number],
    ticks: Array.from(
      { length: Math.round((upper - lower) / step) + 1 },
      (_, i) => lower + i * step,
    ),
  };
}
export function glucoseZoneColor(value: number, inner = false): string {
  if (value < 54) return "#C2410C";
  if (value < 70) return "#F97316";
  if (value <= 180) return inner ? "#15803D" : "#86EFAC";
  if (value <= 250) return "#DC2626";
  return "#991B1B";
}
/** SVG objectBoundingBox top = maximum, bottom = minimum, separately per band.
 * Repeated offsets create exact horizontal colour changes at glucose thresholds.
 */
export function glucoseGradientStops(
  bounds: [number, number][],
  inner = false,
) {
  const finite = bounds.filter((pair) => pair.every(Number.isFinite));
  if (!finite.length) return [];
  const minimum = Math.min(...finite.map((pair) => pair[0]));
  const maximum = Math.max(...finite.map((pair) => pair[1]));
  if (maximum <= minimum)
    return [
      { offset: 0, color: glucoseZoneColor(minimum, inner) },
      { offset: 1, color: glucoseZoneColor(minimum, inner) },
    ];
  const epsilon = Math.min((maximum - minimum) / 4, 0.000001);
  const stops = [
    { offset: 0, color: glucoseZoneColor(maximum - epsilon, inner) },
  ];
  for (const threshold of [250, 180, 70, 54]) {
    if (threshold <= minimum || threshold >= maximum) continue;
    const offset = (maximum - threshold) / (maximum - minimum);
    stops.push(
      { offset, color: glucoseZoneColor(threshold + 0.001, inner) },
      { offset, color: glucoseZoneColor(threshold - 0.001, inner) },
    );
  }
  stops.push({ offset: 1, color: glucoseZoneColor(minimum + epsilon, inner) });
  return stops;
}
