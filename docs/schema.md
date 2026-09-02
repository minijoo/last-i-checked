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
  by `symbol`, `WeatherCheck` by `(location, dateStr)`. That value match is what
  makes untrack → re-track non-destructive.

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
  tempUnit: string;           // always "F" (units=imperial)
  rainAmt: number;            // precipitation total for the date, mm (precipitation.total)
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
```

## Object stores

| Store             | keyPath  | autoIncrement | Indexes                                       |
|-------------------|----------|---------------|----------------------------------------------|
| `StockCheck`      | `id`     | yes           | `symbol`, `checkedAt`, `[symbol+checkedAt]`   |
| `WeatherCheck`    | `id`     | yes           | `checkedAt`, `[location+dateStr]`             |
| `TrackedStock`    | `symbol` | no            | `addedAt`                                     |
| `TrackedForecast` | `id`     | yes           | `[location+forecastDate]` (unique), `addedAt` |
| `Setting`         | `key`    | no            | —                                            |

## Migrations

- **v1** — create all stores + indexes above. This is the only Dexie version.

The NWS → OpenWeather switch changed `WeatherCheck` / `TrackedForecast` **fields** but
no keyPath or index, so it needs no Dexie version bump. Incompatible pre-release
`weatherChecks` rows are dropped by a one-time guard in `store.ts`: on first weather
access it compares `settings["weatherGen"]` to a constant and, if stale, clears
`weatherChecks` and writes the new value. `StockCheck` and the stock stores are
untouched. Bump the `weatherGen` constant again if `WeatherCheck` ever changes shape.

## Notes

- Dexie: the `db.version(n).stores({...})` block is the source of truth for
  stores / indexes once `db.ts` exists; this file keeps record shapes + rationale.
- `WeatherCheck.dateStr` and `TrackedForecast.forecastDate` are both `YYYYMMDD` now —
  one `WeatherCheck` row per (location, date) per fetch (day + night temps in that row).
- The `[symbol+checkedAt]` / `[location+dateStr]` compound indexes are the
  graph-query access path (all checks for one item, roughly in time order — the
  graph still sorts by `checkedAt` in memory).
- The home-location rolling window (today + 15 days, a 16-day window) is **derived**,
  not stored in `TrackedForecast`; only explicitly pinned dates get a registry row.
  (Open: revisit if rolling days should auto-pin.)
