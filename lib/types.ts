// Record shapes for the IndexedDB stores. See docs/schema.md for rationale.
// db.ts is the source of truth for stores/indexes.

/** One row per fetch, per symbol. Append-only. */
export interface StockCheck {
  id?: number; // auto-increment PK (absent until persisted)
  checkedAt: number; // epoch ms
  symbol: string;
  price: number; // price at this fetch
}

/** One row per fetch, per (location, date). Append-only. */
export interface WeatherCheck {
  id?: number; // auto-increment PK
  checkedAt: number; // epoch ms
  dateStr: string; // "YYYYMMDD" — calendar date; sorts lexicographically
  location: string; // canonical display name of the forecast location
  latLong: [number, number]; // [lat, long]
  tempDay: number; // °F — OpenWeather temp.day / day_summary temperature.afternoon
  tempNight: number; // °F — OpenWeather temp.night / day_summary temperature.night
  tempUnit: string; // always "F"
  rainAmt: number; // precipitation total for the date, in mm (as OpenWeather returns it)
  source: "forecast" | "summary"; // 16-day daily forecast, or day_summary
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
  forecastDate: string; // "YYYYMMDD" — calendar date
  addedAt: number; // epoch ms
}

/** Misc app state, keyed by a string. */
export interface Setting {
  key: string; // PK, e.g. "homeLocation"
  value: unknown;
}

/** A resolved place: what geocoding returns and what we store for a location. */
export interface LocationRef {
  name: string; // canonical display name, e.g. "Austin, Texas, US"
  latLong: [number, number];
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

/** One day of weather, normalized from either OpenWeather endpoint. */
export interface DailyWeather {
  calKey: string; // "YYYYMMDD" — location-local date
  tempDay: number; // °F
  tempNight: number; // °F
  rainAmt: number; // mm
  source: "forecast" | "summary";
}

export interface GeoResult {
  name: string; // display name, e.g. "Austin, Texas, US"
  latLong: [number, number];
  country: string; // ISO-2 country code
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
