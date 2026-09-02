// Client-side orchestration for the "Fetch" buttons: pull current data from the
// external APIs (via server actions) and append checks through the store.

import { fetchDaySummaries } from "./actions/weather";
import { fetchStockQuotes } from "./actions/stocks";
import { jitterValue, nowForCheck } from "./devtime";
import { calKeyToIso, todayCalendarKeys } from "./format";
import { store } from "./store";
import type { LocationRef, WeatherCheck } from "./types";

export const HOME_WINDOW_DAYS = 16;

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
    // Skip past dates entirely — the row stays until the user unpins it.
    const dates = [...wanted]
      .filter((k) => k >= today)
      .sort()
      .map((k) => ({
        isoDate: calKeyToIso(k),
        source: (k <= windowEnd ? "forecast" : "summary") as
          | "forecast"
          | "summary",
      }));
    if (dates.length === 0) continue;

    const [lat, lon] = ref.latLong;
    const results = await fetchDaySummaries(lat, lon, dates);
    const rows: Array<Omit<WeatherCheck, "id">> = [];
    for (const res of results) {
      if (!res.ok) {
        errors.push(`${name}: ${res.error}`);
        continue;
      }
      rows.push({
        checkedAt: now,
        dateStr: res.day.calKey,
        location: name,
        latLong: ref.latLong,
        tempDay: jitterValue(res.day.tempDay),
        tempNight: jitterValue(res.day.tempNight),
        tempUnit: "F",
        rainAmt: res.day.rainAmt,
        source: res.day.source,
      });
    }
    await store.appendWeatherChecks(rows);
    added += rows.length;
  }

  // Collapse repeated identical errors (e.g. same subscription failure per date).
  return { added, errors: [...new Set(errors)] };
}
