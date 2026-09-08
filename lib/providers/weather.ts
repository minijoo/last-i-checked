// OpenWeather provider — pure fetch+parse, takes an explicit key. Called by the
// /api/weather route handler (SW-reachable) and the weather server actions.

import { calendarKeyFromUnixUTC } from "@/lib/format";
import type { DailyWeather, Result } from "@/lib/types";

function subscriptionError(status: number): string {
  return `OpenWeather responded ${status} — the API key needs an active One Call by Call subscription.`;
}

interface RawTimelineDay {
  dt: number;
  temp?: { day?: number; night?: number };
  rain?: number;
  wind_speed?: number;
}

interface RawSummary {
  temperature?: { afternoon?: number; night?: number };
  precipitation?: { total?: number };
  wind?: { max?: { speed?: number } };
}

/** 10-day forecast for a point in one call (data[0] = today). */
export async function fetchTimeline(
  lat: number,
  lon: number,
  key: string,
): Promise<Result<{ days: DailyWeather[] }>> {
  const url =
    `https://api.openweathermap.org/data/4.0/onecall/timeline/1day` +
    `?lat=${lat}&lon=${lon}&units=imperial&appid=${key}`;
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
    const json = (await res.json()) as { data?: RawTimelineDay[] };
    const days: DailyWeather[] = (json.data ?? []).map((d) => ({
      calKey: calendarKeyFromUnixUTC(d.dt),
      tempDay: d.temp?.day ?? NaN,
      tempNight: d.temp?.night ?? NaN,
      rainAmt: typeof d.rain === "number" ? d.rain : 0,
      windSpeed: d.wind_speed ?? NaN,
      source: "forecast",
    }));
    return { ok: true, days };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Network error contacting OpenWeather",
    };
  }
}

async function fetchDaySummary(
  lat: number,
  lon: number,
  isoDate: string,
  source: "forecast" | "summary",
  key: string,
): Promise<Result<{ day: DailyWeather }>> {
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
        windSpeed: json.wind?.max?.speed ?? NaN,
        source,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Network error contacting OpenWeather",
    };
  }
}

/** Fetch several dates for one point in parallel. Each keeps its own ok/error. */
export async function fetchDaySummaries(
  lat: number,
  lon: number,
  dates: Array<{ isoDate: string; source: "forecast" | "summary" }>,
  key: string,
): Promise<Array<Result<{ day: DailyWeather }>>> {
  return Promise.all(
    dates.map((d) => fetchDaySummary(lat, lon, d.isoDate, d.source, key)),
  );
}
