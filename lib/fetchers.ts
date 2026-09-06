// Client-side orchestration for the "Fetch" buttons: pull current data from the
// external APIs (via server actions) and append checks through the store.

import { fetchDaySummaries, fetchTimeline } from "./actions/weather";
import { fetchStockQuotes } from "./actions/stocks";
import { jitterCustom, jitterOdds, jitterValue, nowForCheck } from "./devtime";
import { calKeyToIso, todayCalendarKeys } from "./format";
import { makeTrackKey } from "./sportsbook";
import { chargedEventOdds } from "./sportsbookCredits";
import { store } from "./store";
import type {
  CustomScrapeResult,
  DailyWeather,
  LocationRef,
  SportsbookCheck,
  TrackedCustom,
  TrackedSportsbook,
  WeatherCheck,
} from "./types";

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
    rainAmt: jitterValue(d.rainAmt),
    windSpeed: jitterValue(d.windSpeed),
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

/**
 * Runs one custom check's fetch via the /api/custom-check route handler (a
 * plain fetch(), not a Server Action, so concurrent per-card fetches don't
 * serialize behind Next's client-side action dispatcher) and appends the
 * resulting CustomCheck row regardless of success or failure.
 */
export async function runCustomFetch(tracked: TrackedCustom): Promise<FetchOutcome> {
  const now = nowForCheck();
  let result: CustomScrapeResult;
  try {
    const res = await fetch("/api/custom-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: tracked.url,
        selector: tracked.selector,
        valueType: tracked.valueType,
      }),
    });
    result = await res.json();
  } catch (e) {
    result = {
      ok: false,
      rawText: "",
      value: null,
      error: e instanceof Error ? e.message : "Network error reaching the fetch service.",
    };
  }

  const value =
    result.ok && typeof result.value === "number"
      ? jitterCustom(result.value)
      : result.value;

  await store.appendCustomCheck({
    checkedAt: now,
    name: tracked.name,
    url: tracked.url,
    selector: tracked.selector,
    valueType: tracked.valueType,
    rawText: result.rawText,
    value,
    status: result.ok ? "ok" : "error",
    errorMessage: result.ok ? undefined : result.error,
  });

  return {
    added: 1,
    errors: result.ok ? [] : [result.error ?? "Fetch failed."],
  };
}

/**
 * Refreshes one home-page section: all tracked outcomes that share a
 * (sportKey, eventId, region, marketKey). One GET-event-odds call (1 credit)
 * covers every book and outcome in the section. Outcomes absent from the
 * response are still recorded, as `unavailable` rows.
 */
export async function runSportsbookFetch(
  rows: TrackedSportsbook[],
): Promise<FetchOutcome> {
  if (rows.length === 0) return { added: 0, errors: [] };
  const { sportKey, eventId, region, marketKey } = rows[0];

  // The app stays out of live betting: once the event starts, freeze.
  if (Date.now() >= rows[0].commenceTime) {
    return { added: 0, errors: ["Event has started — this section is closed."] };
  }

  const now = nowForCheck();
  const res = await chargedEventOdds(sportKey, eventId, region, marketKey);

  if (!res.ok) {
    if (res.kind === "empty") {
      await store.appendSportsbookChecks(
        rows.map((r) => unavailableCheck(r, now)),
      );
      return { added: rows.length, errors: [res.error] };
    }
    return { added: 0, errors: [res.error] };
  }

  const checks: Array<Omit<SportsbookCheck, "id">> = rows.map((r) => {
    const bm = res.odds.bookmakers.find((b) => b.key === r.bookmakerKey);
    const mk = bm?.markets.find((m) => m.key === marketKey);
    const oc = mk?.outcomes.find(
      (o) =>
        o.name === r.outcomeName &&
        (o.description ?? null) === r.outcomeDescription,
    );
    if (!bm || !mk || !oc) return unavailableCheck(r, now);
    const lastUpdate =
      Date.parse(bm.last_update ?? mk.last_update ?? "") || now;
    return {
      checkedAt: now,
      trackKey: makeTrackKey(r),
      price: jitterOdds(oc.price),
      point: oc.point != null ? jitterValue(oc.point) : null,
      oddsFormat: "american",
      lastUpdate,
      rawOutcome: oc,
      status: "ok",
    };
  });

  await store.appendSportsbookChecks(checks);
  if (res.remaining) {
    await store.setSetting("oddsRequestsRemaining", res.remaining);
  }

  const missing = checks.filter((c) => c.status === "unavailable").length;
  return {
    added: checks.length,
    errors:
      missing > 0
        ? [`${missing} outcome${missing === 1 ? "" : "s"} not offered right now.`]
        : [],
  };
}

function unavailableCheck(
  r: TrackedSportsbook,
  now: number,
): Omit<SportsbookCheck, "id"> {
  return {
    checkedAt: now,
    trackKey: makeTrackKey(r),
    price: null,
    point: null,
    oddsFormat: "american",
    lastUpdate: now,
    rawOutcome: null,
    status: "unavailable",
  };
}
