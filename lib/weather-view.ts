import { type NumColumn, toColumns } from "./buckets.ts";
import { fToC, formatRain, mmToInches } from "./format.ts";
import type { WeatherCheck } from "./types.ts";

export type WeatherView = "day" | "night" | "rain" | "wind";

/** Display temperature unit. Weather is always fetched/stored in °F; this is a
 *  pure frontend preference (Setting key "tempUnit"). */
export type TempUnit = "F" | "C";

function pick(view: WeatherView): (c: WeatherCheck) => number {
  if (view === "day") return (c) => c.tempDay;
  if (view === "night") return (c) => c.tempNight;
  if (view === "wind") return (c) => c.windSpeed;
  return (c) => mmToInches(c.rainAmt); // bucket/delta math in the display unit
}

/**
 * Bucketed columns for one weather metric. For the temp views, when `unit` is
 * "C" each raw °F value is converted to °C **before** bucketing — so the
 * per-bucket value and the delta are both computed in °C, at full precision
 * (the UI then rounds: 0 dp for °F, 1 dp for °C).
 */
export function numColumnsFor(
  checks: WeatherCheck[],
  view: WeatherView,
  unit: TempUnit = "F",
  limit = Number.POSITIVE_INFINITY,
): NumColumn[] {
  const get = pick(view);
  const isTemp = view === "day" || view === "night";
  const conv =
    isTemp && unit === "C" ? fToC : (v: number) => v;
  return toColumns(
    checks.map((c) => ({ checkedAt: c.checkedAt, value: conv(get(c)) })),
    "weather",
    limit,
  );
}

export const fmtTemp = (unit: TempUnit) => (v: number) =>
  unit === "C" ? `${v.toFixed(1)}°C` : `${Math.round(v)}°F`;

/** `numColumnsFor("rain", …)` already yields inches, so format that directly. */
export const fmtRainInches = (v: number) => `${v.toFixed(2)}"`;

export const fmtWindMph = (v: number) => `${Math.round(v)} mph`;

export { formatRain };
