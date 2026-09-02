import {
  type NumColumn,
  type TextColumn,
  toColumns,
  toTextColumns,
} from "./buckets";
import type { WeatherCheck } from "./types";

export type WeatherView = "temp" | "rain" | "sky";

export const VIEW_LABELS: Record<WeatherView, string> = {
  temp: "Temp",
  rain: "Rain",
  sky: "Sky",
};

export function splitDayNight(checks: WeatherCheck[]): {
  day: WeatherCheck[];
  night: WeatherCheck[];
} {
  return {
    day: checks.filter((c) => c.dateStr.endsWith(".0")),
    night: checks.filter((c) => c.dateStr.endsWith(".1")),
  };
}

export function numColumnsFor(
  checks: WeatherCheck[],
  view: "temp" | "rain",
  limit = Number.POSITIVE_INFINITY,
): NumColumn[] {
  const pick =
    view === "temp"
      ? (c: WeatherCheck) => c.temp
      : (c: WeatherCheck) => c.rainProb;
  return toColumns(
    checks.map((c) => ({ checkedAt: c.checkedAt, value: pick(c) })),
    "weather",
    limit,
  );
}

export function skyColumnsFor(
  checks: WeatherCheck[],
  limit = Number.POSITIVE_INFINITY,
): TextColumn[] {
  return toTextColumns(
    checks.map((c) => ({ checkedAt: c.checkedAt, value: c.skyCond })),
    "weather",
    limit,
  );
}

export const fmtRain = (v: number) => `${Math.round(v)}%`;
export const fmtTemp = (unit: string) => (v: number) =>
  `${Math.round(v)}°${unit}`;
