// Shared autocheck tick core — runs the due fetches, detects changes, bumps the
// unseen counts. Used by <AutocheckRunner/> (window, Phase A) and sw/index.ts
// (periodicsync, Phase B). The caller does the notifying (window: new
// Notification; SW: registration.showNotification). See docs/autocheck.md.

import {
  changesForCustom,
  changesForSportsbook,
  changesForStocks,
  changesForWeather,
  dueRuns,
  mergeAutocheck,
  type AutocheckCategory,
  type Change,
} from "./autocheck.ts";
import {
  HOME_WINDOW_DAYS,
  runCustomFetch,
  runSportsbookFetch,
  runStockFetch,
  runWeatherFetch,
} from "./fetchers.ts";
import { todayCalendarKeys } from "./format.ts";
import { store } from "./store.ts";

export interface TickResult {
  category: AutocheckCategory;
  changes: Change[];
}

export interface TickOutcome {
  notify: boolean; // the user's "notify on change" preference
  results: TickResult[]; // per category, only where something changed
}

/** Runs one autocheck tick, guarded by a cross-tab/SW Web Lock. Returns the
 *  changes worth telling the user about; it does not fire notifications. */
export async function autocheckTick(): Promise<TickOutcome> {
  const locks =
    typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return runTick();
  let out: TickOutcome = { notify: false, results: [] };
  await locks.request("lic:autocheck", { ifAvailable: true }, async (lock) => {
    if (lock) out = await runTick();
  });
  return out;
}

async function runTick(): Promise<TickOutcome> {
  const cfg = mergeAutocheck(await store.getSetting("autocheck"));
  if (!cfg.enabled) return { notify: cfg.notify, results: [] };

  const lastFetch =
    (await store.getSetting<Partial<Record<AutocheckCategory, number>>>(
      "autocheckLastFetch",
    )) ?? {};
  const due = dueRuns(new Date(), cfg, lastFetch);
  if (due.length === 0) return { notify: cfg.notify, results: [] };

  const results: TickResult[] = [];
  for (const category of [
    ...new Set(due.map((d) => d.category)),
  ] as AutocheckCategory[]) {
    // Both am+pm due (both missed) → one run into the later bucket.
    const stampAt = Math.max(
      ...due.filter((d) => d.category === category).map((d) => d.stampAt),
    );
    const changes = await runCategory(category, stampAt);
    if (changes && changes.length > 0) {
      await bumpUnseen(category, changes.length);
      results.push({ category, changes });
    }
  }
  return { notify: cfg.notify, results };
}

/** Fetch one category and return the changes, or `null` on a hard failure
 *  (leave the slot due for the next tick). */
async function runCategory(
  category: AutocheckCategory,
  stampAt: number,
): Promise<Change[] | null> {
  if (category === "stocks") {
    const r = await runStockFetch({ checkedAt: stampAt });
    if (r.added === 0 && r.errors.length > 0) return null;
    const [tracked, checks] = await Promise.all([
      store.getTrackedStocks(),
      store.getAllStockChecks(),
    ]);
    return changesForStocks(tracked, checks);
  }

  if (category === "weather") {
    const r = await runWeatherFetch({ checkedAt: stampAt });
    if (r.added === 0 && r.errors.length > 0) return null;
    const [home, pins, checks, unitRaw] = await Promise.all([
      store.getHomeLocation(),
      store.getTrackedForecasts(),
      store.getAllWeatherChecks(),
      store.getSetting<"F" | "C">("tempUnit"),
    ]);
    const wanted: Array<{ location: string; dateStr: string }> = [];
    if (home) {
      for (const k of todayCalendarKeys(HOME_WINDOW_DAYS)) {
        wanted.push({ location: home.name, dateStr: k });
      }
    }
    for (const p of pins) {
      wanted.push({ location: p.location, dateStr: p.forecastDate });
    }
    return changesForWeather(wanted, checks, unitRaw === "C" ? "C" : "F");
  }

  if (category === "custom") {
    const tracked = await store.getTrackedCustoms();
    if (tracked.length === 0) return [];
    await Promise.allSettled(
      tracked.map((t) => runCustomFetch(t, { checkedAt: stampAt })),
    );
    return changesForCustom(tracked, await store.getAllCustomChecks());
  }

  // sportsbook
  const tracked = await store.getTrackedSportsbook();
  if (tracked.length === 0) return [];
  const sections = new Map<string, typeof tracked>();
  for (const t of tracked) {
    if (Date.now() >= t.commenceTime) continue; // closed — skip
    const key = `${t.eventId}|${t.marketKey}|${t.region}`;
    const arr = sections.get(key) ?? [];
    arr.push(t);
    sections.set(key, arr);
  }
  for (const rows of sections.values()) {
    await runSportsbookFetch(rows, { checkedAt: stampAt });
  }
  return changesForSportsbook(tracked, await store.getAllSportsbookChecks());
}

async function bumpUnseen(category: AutocheckCategory, n: number) {
  const cur =
    (await store.getSetting<Partial<Record<AutocheckCategory, number>>>(
      "autocheckUnseen",
    )) ?? {};
  await store.setSetting("autocheckUnseen", {
    ...cur,
    [category]: (cur[category] ?? 0) + n,
  });
}

/** Body for a per-category notification, e.g. "NVDA +3.10 → 178.42 · AAPL …". */
export function notificationBody(changes: Change[]): string {
  const head = changes
    .slice(0, 3)
    .map((c) => `${c.label} ${c.text}`)
    .join(" · ");
  return changes.length > 3
    ? `${head} · and ${changes.length - 3} more`
    : head;
}
