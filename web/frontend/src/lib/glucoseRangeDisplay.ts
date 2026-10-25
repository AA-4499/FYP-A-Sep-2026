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
