"use client";

// Phase-A autocheck: no service worker. Ticks on mount, on visibilitychange →
// visible, and every 5 min while the tab is visible; one navigator.locks guard
// so multiple tabs don't double-run. See docs/autocheck.md.

import { useEffect, useRef } from "react";
import {
  AUTOCHECK_LABEL,
  changesForCustom,
  changesForSportsbook,
  changesForStocks,
  changesForWeather,
  dueRuns,
  mergeAutocheck,
  type AutocheckCategory,
  type AutocheckConfig,
  type Change,
} from "@/lib/autocheck";
import {
  HOME_WINDOW_DAYS,
  runCustomFetch,
  runSportsbookFetch,
  runStockFetch,
  runWeatherFetch,
} from "@/lib/fetchers";
import { todayCalendarKeys } from "@/lib/format";
import { store } from "@/lib/store";

const TICK_MS = 5 * 60 * 1000;

const CATEGORY_PATH: Record<AutocheckCategory, string> = {
  stocks: "/stocks",
  weather: "/weather",
  custom: "/custom",
  sportsbook: "/sportsbook",
};

export function AutocheckRunner() {
  const running = useRef(false);

  useEffect(() => {
    const tick = () => void guardedTick(running);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, TICK_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  return null;
}

async function guardedTick(running: React.RefObject<boolean>) {
  if (running.current) return;
  const locks =
    typeof navigator !== "undefined" ? navigator.locks : undefined;
  const run = async () => {
    running.current = true;
    try {
      await runTick();
    } catch {
      /* a bad tick shouldn't wedge the app */
    } finally {
      running.current = false;
    }
  };
  if (!locks) return run();
  await locks.request("lic:autocheck", { ifAvailable: true }, async (lock) => {
    if (lock) await run();
  });
}

async function runTick() {
  const cfg = mergeAutocheck(await store.getSetting("autocheck"));
  if (!cfg.enabled) return;

  const lastFetch =
    (await store.getSetting<Partial<Record<AutocheckCategory, number>>>(
      "autocheckLastFetch",
    )) ?? {};
  const due = dueRuns(new Date(), cfg, lastFetch);
  if (due.length === 0) return;

  for (const category of [
    ...new Set(due.map((d) => d.category)),
  ] as AutocheckCategory[]) {
    // If both am and pm are due (both missed), one run into the later bucket.
    const stampAt = Math.max(
      ...due.filter((d) => d.category === category).map((d) => d.stampAt),
    );
    const changes = await runCategory(category, stampAt);
    if (changes === null || changes.length === 0) continue;
    await bumpUnseen(category, changes.length);
    notify(cfg, category, changes);
  }
}

/** Runs the fetch for a category and returns the changes it produced, or `null`
 *  on a hard failure (leave the slot due for the next tick). */
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

function notify(
  cfg: AutocheckConfig,
  category: AutocheckCategory,
  changes: Change[],
) {
  if (!cfg.notify) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const head = changes
    .slice(0, 3)
    .map((c) => `${c.label} ${c.text}`)
    .join(" · ");
  const more = changes.length > 3 ? ` · and ${changes.length - 3} more` : "";
  const n = new Notification(
    `${AUTOCHECK_LABEL[category]} — ${changes.length} change${
      changes.length === 1 ? "" : "s"
    }`,
    { body: head + more, tag: `autocheck-${category}` },
  );
  n.onclick = () => {
    window.focus();
    window.location.assign(CATEGORY_PATH[category]);
    n.close();
  };
}
