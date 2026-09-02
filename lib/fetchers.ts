// Client-side orchestration for the "Fetch" buttons: pull current data from the
// external APIs (via server actions) and append checks through the store.

import { fetchDaySummaries, fetchTimeline } from "./actions/weather";
import { fetchStockQuotes } from "./actions/stocks";
import { jitterValue, nowForCheck } from "./devtime";
import { calKeyToIso, todayCalendarKeys } from "./format";
import { store } from "./store";
import type { DailyWeather, LocationRef, WeatherCheck } from "./types";

export const HOME_WINDOW_DAYS = 10;

function toRow(
  now: number,
  location: string,
  ref: LocationRef,
  d: DailyWeather,
): Omit<WeatherCheck, "id"> {
  return {
    checkedAt: now,
    dateStr: d.calKey,
    location,
    latLong: ref.latLong,
    tempDay: jitterValue(d.tempDay),
    tempNight: jitterValue(d.tempNight),
    tempUnit: "F",
    rainAmt: d.rainAmt,
    source: d.source,
  };
}

export interface FetchOutcome {
  added: number;
  errors: string[];
}

export async function runStockFetch(): Promise<FetchOutcome> {
  const tracked = await store.getTrackedStocks();
  if (tracked.length === 0) return { added: 0, errors: [] };

  const res = await fetchStockQuotes(tracked.map((t) => t.symbol));
  if (!res.ok) return { added: 0, errors: [res.error] };

  const now = nowForCheck();
  const checks = res.quotes.map((q) => ({
    checkedAt: now,
    symbol: q.symbol,
    price: jitterValue(q.price),
  }));
  await store.appendStockChecks(checks);

  const missing = tracked
    .filter((t) => !res.quotes.some((q) => q.symbol === t.symbol))
    .map((t) => t.symbol);
  const errors =
    missing.length > 0 ? [`No price returned for ${missing.join(", ")}.`] : [];
  return { added: checks.length, errors };
}

export async function runWeatherFetch(): Promise<FetchOutcome> {
  const [home, pins] = await Promise.all([
    store.getHomeLocation(),
    store.getTrackedForecasts(),
  ]);

  // One entry per location; `wanted` is the set of calendar dates for it.
  const locs = new Map<string, { ref: LocationRef; wanted: Set<string> }>();
  const homeWindow = todayCalendarKeys(HOME_WINDOW_DAYS);
  if (home) {
    locs.set(home.name, { ref: home, wanted: new Set(homeWindow) });
  }
  for (const p of pins) {
    const entry =
      locs.get(p.location) ??
      { ref: { name: p.location, latLong: p.latLong }, wanted: new Set<string>() };
    entry.wanted.add(p.forecastDate);
    locs.set(p.location, entry);
  }
  if (locs.size === 0) return { added: 0, errors: [] };

  const today = homeWindow[0];
  const windowEnd = homeWindow[homeWindow.length - 1];
  const now = nowForCheck();
  const errors: string[] = [];
  let added = 0;

  for (const [name, { ref, wanted }] of locs) {
    const [lat, lon] = ref.latLong;
    // Past dates are skipped entirely — the row stays until the user unpins it.
    const inWindow = new Set(
      [...wanted].filter((k) => k >= today && k <= windowEnd),
    );
    const beyond = [...wanted].filter((k) => k > windowEnd).sort();
    if (inWindow.size === 0 && beyond.length === 0) continue;

    const rows: Array<Omit<WeatherCheck, "id">> = [];

    if (inWindow.size > 0) {
      const res = await fetchTimeline(lat, lon); // one call → 10 days
      if (!res.ok) {
        errors.push(`${name}: ${res.error}`);
      } else {
        for (const d of res.days) {
          if (!inWindow.has(d.calKey)) continue;
          rows.push(toRow(now, name, ref, d));
        }
      }
    }

    if (beyond.length > 0) {
      const results = await fetchDaySummaries(
        lat,
        lon,
        beyond.map((k) => ({
          isoDate: calKeyToIso(k),
          source: "summary" as const,
        })),
      );
      for (const res of results) {
        if (!res.ok) {
          errors.push(`${name}: ${res.error}`);
          continue;
        }
        rows.push(toRow(now, name, ref, res.day));
      }
    }

    await store.appendWeatherChecks(rows);
    added += rows.length;
  }

  // Collapse repeated identical errors (e.g. same subscription failure per date).
  return { added, errors: [...new Set(errors)] };
}
