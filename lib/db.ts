import Dexie, { type Table } from "dexie";
import type {
  Setting,
  StockCheck,
  TrackedForecast,
  TrackedStock,
  WeatherCheck,
} from "./types";

// Source of truth for stores + indexes (docs/schema.md keeps the rationale).
// Compound indexes are written in Dexie syntax: [fieldA+fieldB].
export class LicDatabase extends Dexie {
  stockChecks!: Table<StockCheck, number>;
  weatherChecks!: Table<WeatherCheck, number>;
  trackedStocks!: Table<TrackedStock, string>;
  trackedForecasts!: Table<TrackedForecast, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super("last-i-checked");
    this.version(1).stores({
      stockChecks: "++id, symbol, checkedAt, [symbol+checkedAt]",
      weatherChecks: "++id, checkedAt, [location+dateStr]",
      trackedStocks: "symbol, addedAt",
      trackedForecasts: "++id, &[location+forecastDate], addedAt",
      settings: "key",
    });
  }
}

let _db: LicDatabase | null = null;

/**
 * Lazily create the Dexie instance. Never touches IndexedDB until the first
 * query, so importing this module during SSR of a client component is safe;
 * calling getDb() from server code throws.
 */
export function getDb(): LicDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("getDb() called outside the browser");
  }
  if (!_db) _db = new LicDatabase();
  return _db;
}
