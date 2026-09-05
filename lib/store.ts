// Data-access module — the single seam between the app and storage.
//
// Every read/write goes through the `Store` interface. v1 ships only `LocalStore`
// (IndexedDB via Dexie). v2 can add a `RemoteStore` (cloud DB + auth) behind the
// same interface without touching call sites. See docs/plan.md "Data".

import Dexie from "dexie";
import { getDb } from "./db";
import { calendarKey } from "./format";
import type {
  BackupBlob,
  CustomCheck,
  LocationRef,
  Setting,
  StockCheck,
  TrackedCustom,
  TrackedForecast,
  TrackedStock,
  WeatherCheck,
} from "./types";

export const HOME_LOCATION_KEY = "homeLocation";

// Dexie key sentinels for open-ended compound-index range bounds.
const MIN_KEY = Dexie.minKey;
const MAX_KEY = Dexie.maxKey;

// One-time guard: the NWS→OpenWeather switch changed WeatherCheck fields (no
// index change, so no Dexie version bump). Drop rows written under an older shape.
// Bump this string if WeatherCheck changes shape again.
//
// This runs once at module load (browser only), NOT inside a query — Dexie's
// useLiveQuery runs its querier read-only and would throw on the write. Live
// queries re-fire after the clear via Dexie observability, so the UI corrects
// itself on first load after an upgrade.
const WEATHER_GEN = "openweather-2"; // bumped: WeatherCheck gained windSpeed
let weatherReadyPromise: Promise<void> | null = null;

function weatherReady(): Promise<void> {
  if (!weatherReadyPromise) {
    weatherReadyPromise = (async () => {
      const db = getDb();
      const row = await db.settings.get("weatherGen");
      if (row?.value === WEATHER_GEN) return;
      await db.weatherChecks.clear();
      await db.settings.put({ key: "weatherGen", value: WEATHER_GEN });
    })();
  }
  return weatherReadyPromise;
}

if (typeof indexedDB !== "undefined") {
  void weatherReady();
}

export interface Store {
  // --- stocks: registry ---
  getTrackedStocks(): Promise<TrackedStock[]>;
  addTrackedStock(symbol: string): Promise<void>;
  removeTrackedStock(symbol: string): Promise<void>;

  // --- stocks: append-only checks ---
  appendStockChecks(checks: Array<Omit<StockCheck, "id">>): Promise<void>;
  getStockChecks(symbol: string): Promise<StockCheck[]>; // ascending by checkedAt
  getAllStockChecks(): Promise<StockCheck[]>;

  // --- weather: home location + registry ---
  getHomeLocation(): Promise<LocationRef | null>;
  setHomeLocation(loc: LocationRef): Promise<void>;
  getTrackedForecasts(): Promise<TrackedForecast[]>;
  addTrackedForecast(loc: LocationRef, forecastDate: string): Promise<void>;
  removeTrackedForecast(id: number): Promise<void>;

  // --- weather: append-only checks ---
  appendWeatherChecks(checks: Array<Omit<WeatherCheck, "id">>): Promise<void>;
  getWeatherChecks(location: string, calKey: string): Promise<WeatherCheck[]>;
  getAllWeatherChecks(): Promise<WeatherCheck[]>;

  // --- custom checks: registry ---
  getTrackedCustoms(): Promise<TrackedCustom[]>;
  addTrackedCustom(input: Omit<TrackedCustom, "addedAt">): Promise<void>;
  removeTrackedCustom(name: string): Promise<void>;

  // --- custom checks: append-only checks ---
  appendCustomCheck(check: Omit<CustomCheck, "id">): Promise<void>;
  getCustomChecks(name: string): Promise<CustomCheck[]>; // ascending by checkedAt
  getAllCustomChecks(): Promise<CustomCheck[]>

  // --- generic settings ---
  getSetting<T = unknown>(key: string): Promise<T | undefined>;
  setSetting(key: string, value: unknown): Promise<void>;

  // --- backup ---
  exportAll(): Promise<BackupBlob>;
  importAll(blob: BackupBlob, mode: "replace" | "merge"): Promise<void>;
}

class LocalStore implements Store {
  getTrackedStocks(): Promise<TrackedStock[]> {
    return getDb().trackedStocks.orderBy("symbol").reverse().toArray();
  }

  async addTrackedStock(symbol: string): Promise<void> {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    await getDb().trackedStocks.put({ symbol: s, addedAt: Date.now() });
  }

  async removeTrackedStock(symbol: string): Promise<void> {
    // Deletes only the registry row; StockCheck history is left intact.
    await getDb().trackedStocks.delete(symbol.trim().toUpperCase());
  }

  async appendStockChecks(
    checks: Array<Omit<StockCheck, "id">>,
  ): Promise<void> {
    if (checks.length === 0) return;
    await getDb().stockChecks.bulkAdd(checks as StockCheck[]);
  }

  getStockChecks(symbol: string): Promise<StockCheck[]> {
    return getDb()
      .stockChecks.where("[symbol+checkedAt]")
      .between([symbol, MIN_KEY], [symbol, MAX_KEY])
      .toArray();
  }

  getAllStockChecks(): Promise<StockCheck[]> {
    return getDb().stockChecks.orderBy("checkedAt").toArray();
  }

  async getHomeLocation(): Promise<LocationRef | null> {
    const row = await getDb().settings.get(HOME_LOCATION_KEY);
    return row ? (row.value as LocationRef) : null;
  }

  async setHomeLocation(loc: LocationRef): Promise<void> {
    await getDb().settings.put({ key: HOME_LOCATION_KEY, value: loc });
  }

  getTrackedForecasts(): Promise<TrackedForecast[]> {
    return getDb().trackedForecasts.orderBy("addedAt").toArray();
  }

  async addTrackedForecast(
    loc: LocationRef,
    forecastDate: string,
  ): Promise<void> {
    const db = getDb();
    const existing = await db.trackedForecasts
      .where("[location+forecastDate]")
      .equals([loc.name, forecastDate])
      .first();
    if (existing) return; // unique pin already present
    await db.trackedForecasts.add({
      location: loc.name,
      latLong: loc.latLong,
      forecastDate,
      addedAt: Date.now(),
    });
  }

  async removeTrackedForecast(id: number): Promise<void> {
    // Deletes only the registry row; WeatherCheck history is left intact.
    await getDb().trackedForecasts.delete(id);
  }

  async appendWeatherChecks(
    checks: Array<Omit<WeatherCheck, "id">>,
  ): Promise<void> {
    if (checks.length === 0) return;
    await weatherReady();
    await getDb().weatherChecks.bulkAdd(checks as WeatherCheck[]);
  }

  getWeatherChecks(location: string, calKey: string): Promise<WeatherCheck[]> {
    return getDb()
      .weatherChecks.where("[location+dateStr]")
      .equals([location, calKey])
      .toArray();
  }

  getAllWeatherChecks(): Promise<WeatherCheck[]> {
    return getDb().weatherChecks.orderBy("checkedAt").toArray();
  }

  getTrackedCustoms(): Promise<TrackedCustom[]> {
    return getDb().trackedCustoms.orderBy("addedAt").toArray();
  }

  async addTrackedCustom(input: Omit<TrackedCustom, "addedAt">): Promise<void> {
    const name = input.name.trim();
    if (!name || !input.url.trim() || !input.selector.trim()) return;
    // put(), not add(): re-adding a name the user previously untracked is
    // intentional (same convention as addTrackedStock) — history resurfaces.
    await getDb().trackedCustoms.put({
      name,
      url: input.url.trim(),
      selector: input.selector.trim(),
      valueType: input.valueType,
      addedAt: Date.now(),
    });
  }

  async removeTrackedCustom(name: string): Promise<void> {
    // Deletes only the registry row; CustomCheck history is left intact.
    await getDb().trackedCustoms.delete(name.trim());
  }

  async appendCustomCheck(check: Omit<CustomCheck, "id">): Promise<void> {
    await getDb().customChecks.add(check as CustomCheck);
  }

  getCustomChecks(name: string): Promise<CustomCheck[]> {
    return getDb()
      .customChecks.where("[name+checkedAt]")
      .between([name, MIN_KEY], [name, MAX_KEY])
      .toArray();
  }

  getAllCustomChecks(): Promise<CustomCheck[]> {
    return getDb().customChecks.orderBy("checkedAt").toArray();
  }

  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    const row = await getDb().settings.get(key);
    return row ? (row.value as T) : undefined;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await getDb().settings.put({ key, value });
  }

  async exportAll(): Promise<BackupBlob> {
    const db = getDb();
    const [
      stockChecks,
      weatherChecks,
      trackedStocks,
      trackedForecasts,
      settings,
      trackedCustoms,
      customChecks,
    ] = await Promise.all([
      db.stockChecks.toArray(),
      db.weatherChecks.toArray(),
      db.trackedStocks.toArray(),
      db.trackedForecasts.toArray(),
      db.settings.toArray(),
      db.trackedCustoms.toArray(),
      db.customChecks.toArray(),
    ]);
    return {
      app: "last-i-checked",
      version: 1,
      exportedAt: Date.now(),
      stockChecks,
      weatherChecks,
      trackedStocks,
      trackedForecasts,
      settings,
      trackedCustoms,
      customChecks,
    };
  }

  async importAll(
    blob: BackupBlob,
    mode: "replace" | "merge",
  ): Promise<void> {
    if (blob.app !== "last-i-checked") {
      throw new Error("Not a Last I Checked backup file.");
    }
    const db = getDb();
    await db.transaction(
      "rw",
      [
        db.stockChecks,
        db.weatherChecks,
        db.trackedStocks,
        db.trackedForecasts,
        db.settings,
        db.trackedCustoms,
        db.customChecks,
      ],
      async () => {
        if (mode === "replace") {
          await Promise.all([
            db.stockChecks.clear(),
            db.weatherChecks.clear(),
            db.trackedStocks.clear(),
            db.trackedForecasts.clear(),
            db.settings.clear(),
            db.trackedCustoms.clear(),
            db.customChecks.clear(),
          ]);
        }
        // Drop ids so append-only rows re-key cleanly and never collide.
        const strip = <T extends { id?: number }>(rows: T[]) =>
          rows.map((row) => {
            const copy = { ...row };
            delete copy.id;
            return copy;
          });
        await db.stockChecks.bulkAdd(strip(blob.stockChecks ?? []));
        await db.weatherChecks.bulkAdd(strip(blob.weatherChecks ?? []));
        await db.trackedStocks.bulkPut(blob.trackedStocks ?? []);
        await db.trackedForecasts.bulkPut(
          strip(blob.trackedForecasts ?? []) as TrackedForecast[],
        );
        await db.settings.bulkPut((blob.settings ?? []) as Setting[]);
        await db.trackedCustoms.bulkPut(blob.trackedCustoms ?? []);
        await db.customChecks.bulkAdd(
          strip(blob.customChecks ?? []) as CustomCheck[],
        );
      },
    );
  }
}

/** The app-wide store handle. Swap the implementation here for v2. */
export const store: Store = new LocalStore();

/** Convenience: today's calendar key ("YYYYMMDD"). */
export function today(): string {
  return calendarKey(new Date());
}
