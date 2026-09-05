import { type NumColumn, toColumns } from "./buckets";
import { formatRain, mmToInches } from "./format";
import type { WeatherCheck } from "./types";

export type WeatherView = "day" | "night" | "rain" | "wind";

function pick(view: WeatherView): (c: WeatherCheck) => number {
  if (view === "day") return (c) => c.tempDay;
  if (view === "night") return (c) => c.tempNight;
  if (view === "wind") return (c) => c.windSpeed;
  return (c) => mmToInches(c.rainAmt); // bucket/delta math in the display unit
}

export function numColumnsFor(
  checks: WeatherCheck[],
  view: WeatherView,
  limit = Number.POSITIVE_INFINITY,
): NumColumn[] {
  const get = pick(view);
  return toColumns(
    checks.map((c) => ({ checkedAt: c.checkedAt, value: get(c) })),
    "weather",
    limit,
  );
}

export const fmtTemp = (unit: string) => (v: number) =>
  `${Math.round(v)}°${unit}`;

/** `numColumnsFor("rain", …)` already yields inches, so format that directly. */
export const fmtRainInches = (v: number) => `${v.toFixed(2)}"`;

export const fmtWindMph = (v: number) => `${Math.round(v)} mph`;

export { formatRain };
