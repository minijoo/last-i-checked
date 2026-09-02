# Last I Checked — Plan

## Summary

Show history of your stock prices and weather forecasts compared to when you last
checked them.

Problem: Reading data when checking things like stocks, weather, and sports standings
resets our brain to a new state because the data is absolute. Sometimes our brain caches
some of the values and is able to figure out whether the number increased or decreased,
and by how much. This gives these numbers more meaning. This app attempts to help users
make those connections to previous times they've checked something, and give more
meaning to those numbers.

## Goals

- User can quickly understand if the new number increased or decreased from last time,
  and by how much.
- User can add new items (new stock symbols or new date/location) to track.

## Non-Goals

- It does not need to replace weather or stock apps. This app just focuses on the large
  numbers, like PRICE or TEMPERATURE/RAIN PROBABILITY/SKY CONDITION. Highs, lows (for
  stocks), feels-likes, humidity (for weather) are not priority.

## Core Concepts

- Data that is retrieved is always from the current, most up-to-date information.
  Historical data is never retrieved. But history of your checks are stored, so every
  time a user "checks the app", they are adding to their history. (Note: "checks the
  app" will, to start, be a "fetch" button)
- `StockCheck` is an object/collection that tracks the price of a stock at various
  points, i.e. 3 values: price, stock symbol, time.
- `WeatherCheck` is similar but tracks a few more values: check time, location name,
  lat/long, forecast date (each day split into day and night), temperature, temperature
  unit, rain probability, sky condition.
- The `StockCheck` / `WeatherCheck` stores are **append-only** in normal use: a fetch
  only inserts rows. Pruning old history is a later concern (see Open Questions).
- What the user is *currently tracking* lives in separate **registry** stores
  (`TrackedStock`, `TrackedForecast`) plus a `Setting` store for the home location.
  Adding an item writes a registry row; "untracking" deletes only that registry row —
  the check history stays, so re-adding the same symbol or location-date later brings
  its past checks back into the graph. History is matched to an item by value
  (`symbol`, or `(location, dateStr)`), not by an id.
- These two objects exist independently and are not related. They live on their own,
  separate pages.

## Delta baseline

The point of the app is "what changed since last I checked" — but a manual Fetch button
means the user can check many times in a short span, and comparing each check against the
immediately previous one dilutes the delta to noise (`+0.02 since 12 seconds ago`).

**Bucket the history, then compare bucket-to-bucket.**

- A **bucket** is one distinct calendar day for stocks, or one distinct half-day
  (split at local noon) for weather. Weather forecasts for a fixed future date genuinely
  move within a day as that date approaches, so they get the finer bucket; stock price at
  this app's altitude does not.
- A bucket's **value** is its *last* check ("where it stood when I left off"). Re-fetching
  within the current bucket updates that value in place — it does not add a bucket — so
  mashing Fetch cannot move the deltas.
- A bucket's **delta** is its value minus the next-older populated bucket's value.

**Presentation.** Show the recent buckets as a row of columns, newest on the left, each
column headed by its date. The delta sits under the value:

```
|   9/1     |   8/28    |   8/24   |
|-----------|-----------|----------|
| 105 (+3)  | 102 (+2)  |   100    |
```

Adjacent date headers make the baseline self-evident — `+3` under the `9/1` column next
to an `8/28` column reads as "+$3 since 8/28" without stating it, even when several days
separate the two. Hover/tap a delta to spell it out explicitly. The oldest shown column,
and any item on its first-ever check, show a value with no delta.

- `rainProb` is a percentage (0-100), from NWS `probabilityOfPrecipitation` — a
  likelihood, not a quantity of rain.
- Sky condition (weather) is text, not a number: the column shows the `shortForecast`
  string and the delta becomes "changed" / "same" vs. the prior column.
- The single-item detail page still plots **every raw check** on its graph; the columnar
  view is the list/home-screen summary.
- How many columns: a few on the list view, more on the detail page (exact counts TBD
  against the mockups).

_Alternative considered:_ baseline = "most recent check at least N hours old" (N ≈ 18 for
stocks, ≈ 6 for weather) instead of calendar buckets. Avoids a midnight cliff and handles
sparse history smoothly; loses the clean day-column model. Start with buckets; revisit if
the cliff feels wrong in practice.

## Screens / Flows

- Weather page
    - Assuming the home location is set, by default, today's date and each of the 6 days
      following it are rendered onto the screen. (`mockups/weather-home.png`)
    - Any date for any location (i.e. location-date pair) can be added for tracking
      (`mockups/weather-add.png`). This writes a `TrackedForecast` row (`forecastDate` =
      `YYYYMMDD`, no day/night suffix). If the pinned date is outside NWS's ~7-day
      window, fetches store nothing for it until it comes into range.
    - The home location's today + 6 days are a rolling, derived view — not
      `TrackedForecast` rows. Only explicitly pinned dates are registry rows.
    - Untracking a location-date deletes only its `TrackedForecast` row; past
      `WeatherCheck` rows are kept.
    - Searching a location should asynchronously provide location suggestions based on
      response from `GeoNames`. Autocomplete should implement debouncing to avoid
      unnecessary API calls. NWS covers the US and its territories only — non-US results
      should be filtered out or shown as "not supported" for now.
    - View can be toggled between temperature, rain probability, and sky conditions
      (`mockups/weather-rain.png`)
    - Each day's forecast is split into two: day and night.
    - Click into a single day view, and you can see a graph of the most recent checks
      you've made for that day/location. (`mockups/weather-day-page.png`)

- Stocks page
    - Stocks can be added by searching the ticker symbol, and clicking the "plus sign"
      next to the symbol that should be added. (`mockups/stocks-search.png`) This writes
      a `TrackedStock` row; no price is stored until the next fetch, so a freshly added
      symbol shows a "not checked yet" state.
    - Untracking a symbol deletes only its `TrackedStock` row; past `StockCheck` rows are
      kept.
    - On the homepage, all unique stocks in `StockCheck[]` are shown in reverse
      alphabetical order. (`mockups/stocks-home.png`)
    - When "fetch" is clicked, the most up-to-date data is retrieved for all symbols
      preferably in bulk. This may be automated to run upon opening the page, but keeping
      it a manual button for now. (`mockups/stock-fetch.png`)
    - Click into a single stock view, and you can see a graph of the most recent checks
      you've made for that stock. (`mockups/stocks-symbol-page.png`)

## Data

_High-level only; details go in `docs/schema.md`._

- Stored in IndexedDB (`last-i-checked`)
- Stores: append-only checks (`StockCheck`, `WeatherCheck`) + registry (`TrackedStock`,
  `TrackedForecast`) + `Setting` (home location)
- **All reads and writes go through one data-access module** (e.g. `lib/store.ts`)
  exposing an app-level interface (`getTrackedStocks()`, `appendStockChecks()`,
  `getChecksForSymbol()`, …). Components and server actions never touch Dexie/IndexedDB
  directly. v1 ships a single `LocalStore` implementation; v2 adds a `RemoteStore`
  (cloud DB + auth) behind the same interface, so the sync work is one seam to swap
  rather than call sites scattered across the UI.
- **Export / import JSON** (v1): a Settings action that serializes every store to a
  downloadable `.json` file, and an import that restores it. This is the only recovery
  path in v1 (no server copy) and the migration on-ramp into v2. Implemented on the
  data-access module so it stays storage-agnostic.

## External Data-Sources

- Stocks: ALPACA API
    - Method:
      `GET https://data.alpaca.markets/v2/stocks/snapshots?symbols=AAPL,TSLA,MSFT,GOOGL`
    - Can retrieve in bulk.
    - Response is JSON. Stock price will be `latestTrade.p`
- Weather: NWS API
    - There is a two-step process to get the forecast for a location. API will always
      respond with the 7-day forecast.
    - First use: `GET https://api.weather.gov/points/{latitude},{longitude}` to get the
      forecast office and grid X/Y for that point. Then fetch the forecast from the
      returned grid URL:
      `GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/forecast`. This
      returns the forecast for each of the 6 days after the current day, further split
      into day and night. The values we are interested in are `temperature`,
      `temperatureUnit`, `probabilityOfPrecipitation`, `shortForecast` on the object at
      `properties.periods[x]`.
    - `/points` returns 404 for coordinates outside NWS coverage (non-US) — treat as
      "location not supported". The grid mapping is static per point, so cache the
      returned grid-forecast URL (`gridUrl` on the `TrackedForecast` row / `homeLocation`
      setting) instead of re-running `/points` every fetch. Requires a `User-Agent`
      header or NWS returns 403.
- Geolocation: GeoNames
    - Method:
      `http://api.geonames.org/searchJSON?name_startsWith=Lon&featureClass=P&maxRows=10&username=YOUR_USERNAME`
    - `featureClass=P` should limit results by populated areas like cities.
    - Response should contain lat/long values, which should be saved in memory, then
      saved to a `WeatherCheck` object if the fetch is performed. Lat/long should be used
      in the NWS API call to retrieve the forecast data.

## Decisions

- **Cloud sync → v2.** v1 is IndexedDB-only; server actions stay pure API proxies (no
  accounts, no server-side persistence). Clearing browser data wipes v1 history.
- **Weather is US-only for now** — NWS coverage. Non-US GeoNames results are filtered out
  / shown as unsupported.
- **`rainAmt` → `rainProb`** — a percentage from NWS `probabilityOfPrecipitation`. No QPF
  call; rain *amount* is out of scope.
- **Rolling weather window stays derived.** Only date+location pairs the user actively
  adds become `TrackedForecast` rows; the home location's today + 6 days are never
  auto-pinned.
- **One data-access module** fronts all storage (see Data), so v2's cloud/sync layer
  swaps one implementation instead of rewriting call sites.
- **Export / import-JSON button ships in v1** — the only data-recovery path while there
  is no server copy, and the v2 migration on-ramp.

## Open Questions

- Adding Sports page next.
- Pruning / retention for the append-only check stores — deferred; nothing prunes for
  now.
- Migrating storage to a cloud DB (MongoDB Atlas or similar) — revisit in v2 alongside
  cloud sync / accounts.

## Milestones

1. Scaffold Next.JS app
2. Data layer: IndexedDB stores (per `schema.md`) behind the `lib/store.ts` data-access
   module with a `LocalStore` implementation; export / import-JSON built on it
3. Commit init work to a GitHub remote repo
4. Iterate using puppeteer
5. Deploy to Vercel and test out first draft
