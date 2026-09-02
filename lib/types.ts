// Record shapes for the IndexedDB stores. See docs/schema.md for rationale.
// db.ts is the source of truth for stores/indexes.

/** One row per fetch, per symbol. Append-only. */
export interface StockCheck {
  id?: number; // auto-increment PK (absent until persisted)
  checkedAt: number; // epoch ms
  symbol: string;
  price: number; // price at this fetch
}

/** One row per fetch, per (location, date, day|night). Append-only. */
export interface WeatherCheck {
  id?: number; // auto-increment PK
  checkedAt: number; // epoch ms
  dateStr: string; // "YYYYMMDD.X" — X is 0 (day) or 1 (night); sorts lexicographically
  location: string; // canonical display name of the forecast location
  latLong: [number, number]; // [lat, long]
  temp: number;
  tempUnit: string; // "F" | "C"
  rainProb: number; // precip probability %, 0-100 (NWS probabilityOfPrecipitation)
  skyCond: string; // NWS shortForecast text
}

/** Registry: stock symbols the user is tracking right now. */
export interface TrackedStock {
  symbol: string; // PK
  addedAt: number; // epoch ms
}

/** Registry: (location, calendar-date) pairs the user has pinned. */
export interface TrackedForecast {
  id?: number; // auto-increment PK
  location: string; // canonical display name (matches WeatherCheck.location)
  latLong: [number, number]; // [lat, long]
  forecastDate: string; // "YYYYMMDD" — calendar date only, no .X suffix
  gridUrl: string; // cached NWS /gridpoints forecast URL for this point
  addedAt: number; // epoch ms
}

/** Misc app state, keyed by a string. */
export interface Setting {
  key: string; // PK, e.g. "homeLocation"
  value: unknown;
}

/** A resolved place: what geocoding returns and what we store for a location. */
export interface LocationRef {
  name: string; // canonical display name, e.g. "Denver, Colorado"
  latLong: [number, number];
  gridUrl?: string; // cached NWS forecast URL once resolved
}

// ---- External-API payloads (server action results) ----

export interface StockQuote {
  symbol: string;
  price: number;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
}

/** One NWS forecast period, normalized. */
export interface ForecastPeriod {
  calKey: string; // "YYYYMMDD" — location-local date
  isNight: boolean;
  dateStr: string; // "YYYYMMDD.X"
  name: string; // "Monday", "Monday Night"
  temp: number;
  tempUnit: string; // "F" | "C"
  rainProb: number; // 0-100
  skyCond: string; // shortForecast
}

export interface GeoResult {
  name: string; // "Denver, Colorado"
  latLong: [number, number];
  country: string; // ISO-2, always "US" after filtering
}

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Shape of a full backup produced by the export button. */
export interface BackupBlob {
  app: "last-i-checked";
  version: 1;
  exportedAt: number;
  stockChecks: StockCheck[];
  weatherChecks: WeatherCheck[];
  trackedStocks: TrackedStock[];
  trackedForecasts: TrackedForecast[];
  settings: Setting[];
}
