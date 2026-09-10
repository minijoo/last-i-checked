"use client";

// Live queries backed by Dexie's observability: components re-render when the
// underlying stores change (e.g. after a fetch appends checks). `undefined`
// means "still loading".

import { useLiveQuery } from "dexie-react-hooks";
import { mergeAutocheck } from "./autocheck";
import { getOddsAccess } from "./sportsbookCredits";
import { store } from "./store";
import type { AutocheckCategory } from "./types";

export function useTrackedStocks() {
  return useLiveQuery(() => store.getTrackedStocks());
}

export function useAllStockChecks() {
  return useLiveQuery(() => store.getAllStockChecks());
}

export function useStockChecks(symbol: string) {
  return useLiveQuery(() => store.getStockChecks(symbol), [symbol]);
}

export function useHomeLocation() {
  return useLiveQuery(() => store.getHomeLocation());
}

/** Display temperature unit ("F" default). Pure frontend — see weather-view.ts. */
export function useTempUnit(): "F" | "C" {
  const v = useLiveQuery(() => store.getSetting<"F" | "C">("tempUnit"));
  return v === "C" ? "C" : "F";
}

export type DeltaPage = "stocks" | "weather" | "sportsbook" | "custom";
export type DeltaMode = "abs" | "pct";

/** Per-page toggle: render matrix deltas as percent change ("pct") vs. the
 *  absolute change ("abs", default). Persisted under `deltaMode:<page>` so it
 *  survives revisits; every table on a page shares the one setting. */
export function useDeltaMode(page: DeltaPage): DeltaMode {
  const v = useLiveQuery(
    () => store.getSetting<DeltaMode>(`deltaMode:${page}`),
    [page],
  );
  return v === "pct" ? "pct" : "abs";
}

/** Flip a page's delta mode and persist it. */
export function toggleDeltaMode(page: DeltaPage, current: DeltaMode): void {
  void store.setSetting(`deltaMode:${page}`, current === "pct" ? "abs" : "pct");
}

export function useTrackedForecasts() {
  return useLiveQuery(() => store.getTrackedForecasts());
}

export function useAllWeatherChecks() {
  return useLiveQuery(() => store.getAllWeatherChecks());
}

export function useWeatherChecks(location: string, calKey: string) {
  return useLiveQuery(
    () => store.getWeatherChecks(location, calKey),
    [location, calKey],
  );
}

export function useTrackedCustoms() {
  return useLiveQuery(() => store.getTrackedCustoms());
}

export function useCustomChecks(name: string) {
  return useLiveQuery(() => store.getCustomChecks(name), [name]);
}

export function useAllCustomChecks() {
  return useLiveQuery(() => store.getAllCustomChecks());
}

export function useTrackedSportsbook() {
  return useLiveQuery(() => store.getTrackedSportsbook());
}

export function useAllSportsbookChecks() {
  return useLiveQuery(() => store.getAllSportsbookChecks());
}

export function useSportsbookChecks(trackKey: string) {
  return useLiveQuery(() => store.getSportsbookChecks(trackKey), [trackKey]);
}

/** Trial-credit standing + whether a user key is set. Reactive to Setting
 *  writes (Dexie observes the `.get()` reads inside getOddsAccess). */
export function useSportsbookAccess() {
  return useLiveQuery(() => getOddsAccess());
}

export function useAutocheckConfig() {
  return useLiveQuery(async () =>
    mergeAutocheck(await store.getSetting("autocheck")),
  );
}

export function useAutocheckUnseen() {
  return useLiveQuery(
    async () =>
      (await store.getSetting<Partial<Record<AutocheckCategory, number>>>(
        "autocheckUnseen",
      )) ?? {},
  );
}
