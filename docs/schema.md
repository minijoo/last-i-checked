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

interface WeatherCheck {      // one row per fetch, per (location, date, day|night); append-only
  id: number;                 // auto-increment PK
  checkedAt: number;          // epoch ms
  dateStr: string;            // "YYYYMMDD.X" — X is 0 (day) or 1 (night); sorts lexicographically
  location: string;           // canonical display name of the forecast location
  latLong: number[];          // [lat, long]
  temp: number;
  tempUnit: string;           // "F" | "C"
  rainProb: number;           // precip probability %, 0-100 (NWS probabilityOfPrecipitation)
  skyCond: string;            // NWS shortForecast text
}

interface TrackedStock {      // registry: symbols tracked right now
  symbol: string;             // PK
  addedAt: number;            // epoch ms
}

interface TrackedForecast {   // registry: (location, calendar-date) pairs the user pinned
  id: number;                 // auto-increment PK
  location: string;           // canonical display name (matches WeatherCheck.location)
  latLong: number[];          // [lat, long]
  forecastDate: string;       // "YYYYMMDD" — calendar date only, NO .X day/night suffix
  gridUrl: string;            // cached NWS /gridpoints forecast URL for this point
  addedAt: number;            // epoch ms
}

interface Setting {           // misc app state
  key: string;                // PK, e.g. "homeLocation"
  value: unknown;             // e.g. { location: string, latLong: [number, number], gridUrl: string }
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

- **v1** — create all stores + indexes above.

## Notes

- Dexie: the `db.version(1).stores({...})` block is the source of truth for
  stores / indexes once `db.ts` exists; this file keeps record shapes + rationale.
- `WeatherCheck.dateStr` carries the `.X` day/night suffix; `TrackedForecast.forecastDate`
  does not. One pinned pair → two `WeatherCheck` rows per fetch (`.0` and `.1`).
- The `[symbol+checkedAt]` / `[location+dateStr]` compound indexes are the
  graph-query access path (all checks for one item, roughly in time order — the
  graph still sorts by `checkedAt` in memory).
- The home-location rolling window (today + 6 days) is **derived**, not stored in
  `TrackedForecast`; only explicitly pinned dates get a registry row. Its grid URL
  lives on the `homeLocation` `Setting`. (Open: revisit if rolling days should auto-pin.)
- `gridUrl` is duplicated across pinned dates at the same location — accepted;
  untracking a row then cleans up naturally.
