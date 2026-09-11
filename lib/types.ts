// Record shapes for the IndexedDB stores. See docs/schema.md for rationale.
// db.ts is the source of truth for stores/indexes.

import type { NumberExtractMethod } from "./customExtract";

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
  windSpeed: number; // mph — OpenWeather wind_speed / day_summary wind.max.speed
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

/** Registry: custom URL/selector checks the user is tracking right now. */
export interface TrackedCustom {
  name: string; // PK, unique, user-provided
  url: string;
  selector: string; // CSS selector for the value's location on the page
  valueType: "number" | "text";
  // Only meaningful (and only set) when valueType is "number": how the raw
  // scraped text is turned into a number, chosen in the add form's "Try
  // Extract" step and re-applied on every later fetch. See lib/customExtract.ts.
  extractMethod?: NumberExtractMethod;
  extractRegex?: string; // only set when extractMethod is "regex"
  addedAt: number; // epoch ms
}

/** One row per fetch, per tracked custom check. Append-only. */
export interface CustomCheck {
  id?: number; // auto-increment PK
  checkedAt: number; // epoch ms
  name: string; // matches TrackedCustom.name, not a foreign key
  url: string; // snapshot of TrackedCustom.url at fetch time
  selector: string; // snapshot of TrackedCustom.selector at fetch time
  valueType: "number" | "text"; // snapshot of TrackedCustom.valueType at fetch time
  extractMethod?: NumberExtractMethod; // snapshot of TrackedCustom.extractMethod
  extractRegex?: string; // snapshot of TrackedCustom.extractRegex
  rawText: string; // exact textContent read from the matched element
  value: number | string | null; // extracted per valueType; null when status is "error"
  status: "ok" | "error";
  errorMessage?: string; // present when status is "error"
}

/** Result of one scrape, returned by the /api/custom-check route handler.
 *  Always the raw text found at the selector — the route never parses a
 *  number; that's lib/customExtract.ts's job, run client-side against rawText. */
export interface CustomScrapeResult {
  ok: boolean;
  rawText: string;
  error?: string;
}

// ---- Sportsbook (The Odds API) — see docs/sportsbook.md ----

/** Registry: one row per pinned sportsbook outcome. The re-fetch coordinates
 *  double as the request template; `apiKey` is never stored (server-side only). */
export interface TrackedSportsbook {
  id?: number; // auto-increment PK
  addedAt: number; // epoch ms
  sportKey: string; // "americanfootball_nfl"
  sportTitle: string; // "NFL" — display
  eventId: string; // "" for futures / outright sports
  eventName: string; // `${away} @ ${home}`, or the futures title
  commenceTime: number; // epoch ms — drives the "closed" status
  region: string; // "us" (default); one region per check
  marketKey: string; // "player_pass_tds"
  marketLabel: string; // "Pass Yds (player)" — display
  bookmakerKey: string; // "draftkings"
  bookmakerTitle: string; // "DraftKings"
  outcomeName: string; // "Over" — stable identity field
  outcomeDescription: string | null; // player name for props/futures, else null
  oddsFormat: "american";
}

/** One row per fetch, per pinned outcome. Append-only. Matched to its
 *  TrackedSportsbook row by `trackKey` (a joined value tuple, no `point`). */
export interface SportsbookCheck {
  id?: number; // auto-increment PK
  checkedAt: number; // epoch ms
  trackKey: string; // sportKey|eventId|region|bookmakerKey|marketKey|outcomeName|(desc ?? "")
  price: number | null; // American odds; null if the outcome was absent this fetch
  point: number | null; // line; null for h2h / when absent
  oddsFormat: "american";
  lastUpdate: number; // epoch ms — bookmaker.last_update ?? market.last_update ?? checkedAt
  rawOutcome: unknown; // raw Odds API Outcome JSON — schema-drift insurance
  status: "ok" | "unavailable"; // "unavailable" = fetch ok but this outcome wasn't in it
}

/** A sport as returned by GET /v4/sports. */
export interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

/** An event as returned by GET /v4/sports/{key}/events. */
export interface OddsApiEvent {
  id: string;
  sport_title: string;
  commence_time: string; // ISO
  home_team: string | null;
  away_team: string | null;
}

export interface OddsApiOutcome {
  name: string;
  description?: string;
  price: number;
  point?: number;
}

export interface OddsApiMarket {
  key: string;
  last_update?: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsApiMarket[];
}

/** GET /v4/sports/{key}/events/{id}/odds */
export interface OddsApiEventOdds {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string | null;
  away_team: string | null;
  bookmakers: OddsApiBookmaker[];
}

export type OddsErrorKind =
  | "empty" // 200 but no book posted this market for the event
  | "invalid_combo" // INVALID_MARKET_COMBO — featured/prop vs outright mismatch
  | "invalid_market" // INVALID_MARKET / UNKNOWN_MARKET
  | "event_gone" // EVENT_NOT_FOUND / INVALID_EVENT_ID / 404
  | "credits" // OUT_OF_USAGE_CREDITS
  | "rate" // EXCEEDED_FREQ_LIMIT (429)
  | "key" // MISSING_KEY / INVALID_KEY / DEACTIVATED_KEY
  | "other";

export type OddsResult<T> =
  | ({ ok: true } & T)
  | { ok: false; kind: OddsErrorKind; error: string };

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
  windSpeed: number; // mph
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
  trackedCustoms?: TrackedCustom[]; // optional: absent in backups made before this store existed
  customChecks?: CustomCheck[];
  trackedSportsbook?: TrackedSportsbook[]; // optional: absent in pre-sportsbook backups
  sportsbookChecks?: SportsbookCheck[];
}
