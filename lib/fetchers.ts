// Client-side orchestration for the "Fetch" buttons: pull current data from the
// external APIs (via server actions) and append checks through the store.

import { fetchForecast } from "./actions/weather";
import { fetchStockQuotes } from "./actions/stocks";
import { todayCalendarKeys } from "./format";
import { store } from "./store";
import type { LocationRef } from "./types";

export const HOME_WINDOW_DAYS = 7;

export interface FetchOutcome {
  added: number;
  errors: string[];
}

export async function runStockFetch(): Promise<FetchOutcome> {
  const tracked = await store.getTrackedStocks();
  if (tracked.length === 0) return { added: 0, errors: [] };

  const res = await fetchStockQuotes(tracked.map((t) => t.symbol));
  if (!res.ok) return { added: 0, errors: [res.error] };

  const now = Date.now();
  const checks = res.quotes.map((q) => ({
    checkedAt: now,
    symbol: q.symbol,
    price: q.price,
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

  // Collect the calendar dates we want per location.
  const locs = new Map<
    string,
    { ref: LocationRef; wanted: Set<string>; isHome: boolean }
  >();
  if (home) {
    locs.set(home.name, {
      ref: home,
      wanted: new Set(todayCalendarKeys(HOME_WINDOW_DAYS)),
      isHome: true,
    });
  }
  for (const p of pins) {
    const entry =
      locs.get(p.location) ??
      {
        ref: {
          name: p.location,
          latLong: p.latLong,
          gridUrl: p.gridUrl || undefined,
        },
        wanted: new Set<string>(),
        isHome: false,
      };
    entry.wanted.add(p.forecastDate);
    if (!entry.ref.gridUrl && p.gridUrl) entry.ref.gridUrl = p.gridUrl;
    locs.set(p.location, entry);
  }
  if (locs.size === 0) return { added: 0, errors: [] };

  const now = Date.now();
  const errors: string[] = [];
  let added = 0;

  for (const [name, { ref, wanted }] of locs) {
    const res = await fetchForecast(ref.latLong, ref.gridUrl);
    if (!res.ok) {
      errors.push(`${name}: ${res.error}`);
      continue;
    }
    if (res.gridUrl && res.gridUrl !== ref.gridUrl) {
      if (home && home.name === name) {
        await store.setHomeLocation({ ...home, gridUrl: res.gridUrl });
      }
      await store.updateForecastGridUrl(name, res.gridUrl);
    }
    const checks = res.periods
      .filter((p) => wanted.has(p.calKey))
      .map((p) => ({
        checkedAt: now,
        dateStr: p.dateStr,
        location: name,
        latLong: ref.latLong,
        temp: p.temp,
        tempUnit: p.tempUnit,
        rainProb: p.rainProb,
        skyCond: p.skyCond,
      }));
    await store.appendWeatherChecks(checks);
    added += checks.length;
  }
  return { added, errors };
}
