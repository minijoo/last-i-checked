import { type NumColumn, toColumns } from "./buckets.ts";
import { fToC, formatRain, mmToInches, mphToMs } from "./format.ts";
import type { WeatherCheck } from "./types.ts";

export type WeatherView = "day" | "night" | "rain" | "wind";

/** Display units. Weather is always fetched/stored in °F, mm and mph; these are
 *  pure frontend preferences (Setting keys "tempUnit", "rainUnit", "windUnit"). */
export type TempUnit = "F" | "C";
export type RainUnit = "in" | "mm";
export type WindUnit = "mph" | "ms";

export interface WeatherUnits {
  temp: TempUnit;
  rain: RainUnit;
  wind: WindUnit;
}

/** A stored rain amount (mm) in the display unit. */
export const rainValue = (mm: number, unit: RainUnit): number =>
  unit === "mm" ? mm : mmToInches(mm);

/** A stored wind speed (mph) in the display unit. */
export const windValue = (mph: number, unit: WindUnit): number =>
  unit === "ms" ? mphToMs(mph) : mph;

function pick(view: WeatherView, units: WeatherUnits): (c: WeatherCheck) => number {
  if (view === "day") return (c) => (units.temp === "C" ? fToC(c.tempDay) : c.tempDay);
  if (view === "night")
    return (c) => (units.temp === "C" ? fToC(c.tempNight) : c.tempNight);
  if (view === "wind") return (c) => windValue(c.windSpeed, units.wind);
  return (c) => rainValue(c.rainAmt, units.rain);
}

/**
 * Bucketed columns for one weather metric. Each raw value is converted to the
 * display unit **before** bucketing — so the per-bucket value and the delta are
 * both computed in that unit, at full precision (the UI then rounds: temp 0 dp
 * °F / 1 dp °C, rain 2 dp in / 1 dp mm, wind whole numbers).
 */
export function numColumnsFor(
  checks: WeatherCheck[],
  view: WeatherView,
  units: Partial<WeatherUnits> = {},
  limit = Number.POSITIVE_INFINITY,
): NumColumn[] {
  const get = pick(view, { temp: "F", rain: "in", wind: "mph", ...units });
  return toColumns(
    checks.map((c) => ({ checkedAt: c.checkedAt, value: get(c) })),
    "weather",
    limit,
  );
}

export const fmtTemp = (unit: TempUnit) => (v: number) =>
  unit === "C" ? `${v.toFixed(1)}°C` : `${Math.round(v)}°F`;

/** Decimal places for rain values and deltas: 2 for inches, 1 for millimeters. */
export const rainDigits = (unit: RainUnit): number => (unit === "mm" ? 1 : 2);

/** Expects a value already in `unit` (what `numColumnsFor("rain", …)` yields). */
export const fmtRain = (unit: RainUnit) => (v: number) =>
  unit === "mm" ? `${v.toFixed(1)} mm` : `${v.toFixed(2)}"`;

/** Wind is whole numbers in either unit. */
export const WIND_DIGITS = 0;

/** Expects a value already in `unit` (what `numColumnsFor("wind", …)` yields). */
export const fmtWind = (unit: WindUnit) => (v: number) =>
  `${Math.round(v)} ${unit === "ms" ? "m/s" : "mph"}`;

export { formatRain };
