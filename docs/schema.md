# IndexedDB Schema — Last I Checked

**Database:** `last-i-checked`  ·  **Version:** 1

## Design notes

- **Check stores are append-only.** Every fetch inserts new `StockCheck` /
  `WeatherCheck` rows; nothing is updated or deleted during normal use. A
  pruning / retention strategy is deferred (see `plan.md` Open Questions).
- **Registry stores** (`TrackedStock`, `TrackedForecast`) hold *what the user is
  tracking right now*. Untracking deletes only the registry row — check history
  is left intact, so re-adding the same symbol or location-date later resurfaces
  its past checks in the graph.
- History is matched to an item **by value, not by a foreign key**: `StockCheck`
  by `symbol`, `WeatherCheck` by `(location, dateStr)`, `CustomCheck` by `name`,
  `SportsbookCheck` by `trackKey`. That value match is what makes untrack → re-track
  non-destructive.
- `CustomCheck` also snapshots the `url` / `selector` / `valueType` used at fetch
  time (not just a lookup against the current `TrackedCustom` row), the same way
  `WeatherCheck` snapshots `location` / `latLong` — so a check's history stays
  interpretable even after the user edits the tracked config, and a bad fetch is
  debuggable from the row alone.
- `SportsbookCheck` is append-only like the others, matched to its
  `TrackedSportsbook` row by `trackKey` (a joined coordinate tuple with **no `point`
  in it** — line moves must not orphan history). It snapshots the raw Odds API
  `Outcome` JSON (`rawOutcome`) alongside the extracted `price` / `point`, so a check
  stays interpretable if the upstream schema drifts. Full design: `docs/sportsbook.md`.

## Record types

```ts
interface StockCheck {        // one row per fetch, per symbol; append-only
  id: number;                 // auto-increment PK
  checkedAt: number;          // epoch ms
  symbol: string;
  price: number;              // price at this fetch
}

interface WeatherCheck {      // one row per fetch, per (location, date); append-only
  id: number;                 // auto-increment PK
  checkedAt: number;          // epoch ms
  dateStr: string;            // "YYYYMMDD" — calendar date; sorts lexicographically
  location: string;           // canonical display name of the forecast location
  latLong: number[];          // [lat, long]
  tempDay: number;            // OpenWeather temp.day / day_summary temperature.afternoon (°F)
  tempNight: number;          // OpenWeather temp.night / day_summary temperature.night (°F)
  tempUnit: string;           // always "F" (units=imperial) — display unit is the
                              // Setting "tempUnit" ("F" | "C"), applied client-side

  rainAmt: number;            // precipitation total for the date, mm (precipitation.total)
  windSpeed: number;          // mph — OpenWeather wind_speed / day_summary wind.max.speed
  source: "forecast" | "summary"; // date within HOME_WINDOW_DAYS, or a long-range estimate
}

interface TrackedStock {      // registry: symbols tracked right now
  symbol: string;             // PK
  addedAt: number;            // epoch ms
}

interface TrackedForecast {   // registry: (location, calendar-date) pairs the user pinned
  id: number;                 // auto-increment PK
  location: string;           // canonical display name (matches WeatherCheck.location)
  latLong: number[];          // [lat, long]
  forecastDate: string;       // "YYYYMMDD" — calendar date
  addedAt: number;            // epoch ms
}

interface Setting {           // misc app state
  key: string;                // PK, e.g. "homeLocation"
  value: unknown;             // e.g. { name: string, latLong: [number, number] }
}

interface TrackedCustom {     // registry: custom URL/selector checks tracked right now
  name: string;                // PK, unique, user-provided
  url: string;
  selector: string;            // CSS selector for the value's location on the page
  valueType: "number" | "text";
  addedAt: number;             // epoch ms
}

interface CustomCheck {       // one row per fetch, per tracked custom check; append-only
  id: number;                 // auto-increment PK
  checkedAt: number;          // epoch ms
  name: string;                // matches TrackedCustom.name
  url: string;                 // snapshot of TrackedCustom.url at fetch time
  selector: string;            // snapshot of TrackedCustom.selector at fetch time
  valueType: "number" | "text"; // snapshot of TrackedCustom.valueType at fetch time
  rawText: string;             // exact textContent read from the matched element
  value: number | string | null; // parsed per valueType; null when status is "error"
  status: "ok" | "error";
  errorMessage?: string;        // present when status is "error"
}

interface TrackedSportsbook { // registry: one row per pinned sportsbook outcome
  id: number;                 // auto-increment PK
  addedAt: number;            // epoch ms
  // re-fetch coordinates
  sportKey: string;           // "americanfootball_nfl"
  sportTitle: string;         // "NFL" — display
  eventId: string;            // "" for futures / outright sports
  eventName: string;          // `${away} @ ${home}`, or the futures title
  commenceTime: number;       // epoch ms — drives the "closed" status
  region: string;             // "us" (default); one region per check for now
  marketKey: string;          // "player_pass_tds"
  marketLabel: string;        // "Player Pass TDs" — display, from the market map
  bookmakerKey: string;       // "draftkings"
  bookmakerTitle: string;     // "DraftKings"
  // outcome identity — stable fields only (no `point`)
  outcomeName: string;        // "Over"
  outcomeDescription: string | null; // player name for props/futures, else null
  oddsFormat: "american";     // the coordinates above ARE the refetch template; no apiKey stored
}
// `status` ("active" | "unavailable" | "closed") is derived at render from
// commenceTime + the latest check, not stored on the row.

interface SportsbookCheck {   // one row per fetch, per pinned outcome; append-only
  id: number;                 // auto-increment PK
  checkedAt: number;          // epoch ms
  trackKey: string;           // sportKey|eventId|region|bookmakerKey|marketKey|outcomeName|(outcomeDescription ?? "")
  price: number | null;       // American (or decimal) odds; null if outcome absent this fetch
  point: number | null;       // line; null for h2h / when absent
  oddsFormat: "american" | "decimal";
  lastUpdate: number;         // epoch ms — bookmaker.last_update ?? market.last_update
  rawOutcome: unknown;        // raw Odds API Outcome JSON — schema-drift insurance
  status: "ok" | "unavailable"; // "unavailable" = fetch ok but this outcome wasn't in it
}
```

## Object stores

| Store             | keyPath  | autoIncrement | Indexes                                       |
|-------------------|----------|---------------|----------------------------------------------|
| `StockCheck`      | `id`     | yes           | `symbol`, `checkedAt`, `[symbol+checkedAt]`   |
| `WeatherCheck`    | `id`     | yes           | `checkedAt`, `[location+dateStr]`             |
| `TrackedStock`    | `symbol` | no            | `addedAt`                                     |
| `TrackedForecast` | `id`     | yes           | `[location+forecastDate]` (unique), `addedAt` |
| `Setting`         | `key`    | no            | —                                            |
| `TrackedCustom`   | `name`   | no            | `addedAt`                                     |
| `CustomCheck`     | `id`     | yes           | `name`, `checkedAt`, `[name+checkedAt]`       |
| `TrackedSportsbook` | `id`   | yes           | `addedAt`, `[eventId+marketKey+region]`       |
| `SportsbookCheck` | `id`     | yes           | `trackKey`, `checkedAt`, `[trackKey+checkedAt]` |

## Migrations

- **v1** — create all stores + indexes above. This is the only Dexie version.

The NWS → OpenWeather switch changed `WeatherCheck` / `TrackedForecast` **fields** but
no keyPath or index, so it needs no Dexie version bump. Incompatible pre-release
`weatherChecks` rows are dropped by a one-time guard in `store.ts`: on first weather
access it compares `settings["weatherGen"]` to a constant and, if stale, clears
`weatherChecks` and writes the new value. `StockCheck` and the stock stores are
untouched. Bump the `weatherGen` constant again if `WeatherCheck` ever changes shape
— most recently bumped to `"openweather-2"` when `windSpeed` was added.

## Notes

- Dexie: the `db.version(n).stores({...})` block is the source of truth for
  stores / indexes once `db.ts` exists; this file keeps record shapes + rationale.
- `WeatherCheck.dateStr` and `TrackedForecast.forecastDate` are both `YYYYMMDD` now —
  one `WeatherCheck` row per (location, date) per fetch (day + night temps in that row).
- The `[symbol+checkedAt]` / `[location+dateStr]` / `[name+checkedAt]` /
  `[trackKey+checkedAt]` compound indexes are the graph-query access path (all checks
  for one item, roughly in time order — the graph still sorts by `checkedAt` in
  memory).
- `Setting` rows in use: `homeLocation` (`{ name, latLong } | null`), `weatherGen`
  (schema-generation guard for `WeatherCheck`), `tempUnit` (`"F"` | `"C"` display
  preference — see `useTempUnit` / `lib/weather-view.ts`), and the sportsbook pair
  below.
- Sportsbook credit accounting lives in `Setting` rows, not a store:
  `oddsApiKey` (the user's own Odds API key, or empty) and `sportsbookCredits`
  (`{ month: "YYYY-MM", used: number }`, read as 0 on month rollover or data-clear).
  See `lib/sportsbookCredits.ts`.
- `SportsbookCheck.trackKey` is the joined coordinate tuple
  `sportKey|eventId|region|bookmakerKey|marketKey|outcomeName|(outcomeDescription ?? "")`
  (see `docs/sportsbook.md`) — `point` is deliberately not in it, so a line move
  can't orphan a check's history. `[eventId+marketKey+region]` on `TrackedSportsbook`
  is the home-page section-grouping path (one Fetch button per section).
- The home-location rolling window (today + 9 days, a 10-day window) is **derived**,
  not stored in `TrackedForecast`; only explicitly pinned dates get a registry row.
  (Open: revisit if rolling days should auto-pin.)
