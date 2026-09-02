"use server";

// OpenWeather proxy. Keeps the API key server-side. See docs/plan.md.
//
// Every tracked date is fetched with One Call 3.0 `day_summary` (one call per
// date). The standalone "16 Day Daily Forecast" (data/2.5) is a separate paid
// product our key doesn't carry; day_summary covers near-future dates too, so it
// is the single source. `units=imperial` for Fahrenheit; precipitation is mm.

import type { DailyWeather, Result } from "@/lib/types";

const KEY = () => process.env.OPENWEATHER_API_KEY;
const NO_KEY =
  "OPENWEATHER_API_KEY not set. Add it to .env.local and restart the dev server.";

function subscriptionError(status: number): string {
  return `OpenWeather responded ${status} — the API key needs an active One Call by Call subscription.`;
}

/** One date's summary. `isoDate` is "YYYY-MM-DD". `source` marks horizon, not endpoint. */
export async function fetchDaySummary(
  lat: number,
  lon: number,
  isoDate: string,
  source: "forecast" | "summary" = "summary",
): Promise<Result<{ day: DailyWeather }>> {
  const key = KEY();
  if (!key) return { ok: false, error: NO_KEY };

  const url =
    `https://api.openweathermap.org/data/3.0/onecall/day_summary` +
    `?lat=${lat}&lon=${lon}&date=${isoDate}&units=imperial&appid=${key}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 401 || res.status === 402) {
      return { ok: false, error: subscriptionError(res.status) };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `OpenWeather responded ${res.status} ${res.statusText}`,
      };
    }
    const json = (await res.json()) as RawSummary;
    return {
      ok: true,
      day: {
        calKey: isoDate.replace(/-/g, ""),
        tempDay: json.temperature?.afternoon ?? NaN,
        tempNight: json.temperature?.night ?? NaN,
        rainAmt: json.precipitation?.total ?? 0,
        source,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting OpenWeather",
    };
  }
}

/** Fetch several dates for one point in parallel. Each item keeps its own ok/error. */
export async function fetchDaySummaries(
  lat: number,
  lon: number,
  dates: Array<{ isoDate: string; source: "forecast" | "summary" }>,
): Promise<Array<Result<{ day: DailyWeather }>>> {
  return Promise.all(
    dates.map((d) => fetchDaySummary(lat, lon, d.isoDate, d.source)),
  );
}

interface RawSummary {
  temperature?: { afternoon?: number; night?: number };
  precipitation?: { total?: number };
}
