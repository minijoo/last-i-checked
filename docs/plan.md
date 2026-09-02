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
  numbers, like PRICE or DAY/NIGHT TEMPERATURE and RAIN AMOUNT. Highs, lows (for
  stocks), feels-likes, humidity, sky/conditions text (for weather) are not priority.

## Core Concepts

- Data that is retrieved is always from the current, most up-to-date information.
  Historical data is never retrieved. But history of your checks are stored, so every
  time a user "checks the app", they are adding to their history. (Note: "checks the
  app" will, to start, be a "fetch" button)
- `StockCheck` is an object/collection that tracks the price of a stock at various
  points, i.e. 3 values: price, stock symbol, time.
- `WeatherCheck` is similar but tracks a few more values: check time, location name,
  lat/long, forecast date (one row per calendar date), day temperature, night
  temperature, and rain amount for that date.
- The `StockCheck` / `WeatherCheck` stores are **append-only** in normal use: a fetch
  only inserts rows. Pruning old history is a later concern (see Open Questions).
- What the user is *currently tracking* lives in separate **registry** stores
  (`TrackedStock`, `TrackedForecast`) plus a `Setting` store for the home location.
  Adding an item writes a registry row; "untracking" deletes only that registry row —
  the check history stays, so re-adding the same symbol or location-date later brings
  its past checks back into the graph. History is matched to an item by value
  (`symbol`, or `(location, dateStr)` where `dateStr` is `YYYYMMDD`), not by an id.
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

- `rainAmt` is a quantity of rain for the date (OpenWeather precipitation total).
  OpenWeather always returns precipitation in **mm** even with `units=imperial`; the UI
  converts to inches for display.
- Weather has three numbers per date — day temp, night temp, rain amount — surfaced via
  a Day / Night / Rain view toggle. Each is a plain number with a numeric delta.
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
    - Assuming the home location is set, by default, today's date and each of the 15 days
      following it are rendered onto the screen — a rolling 16-day window.
      (`mockups/weather-home.png`)
    - Any date for any location (i.e. location-date pair) can be added for tracking
      (`mockups/weather-add.png`). This writes a `TrackedForecast` row (`forecastDate` =
      `YYYYMMDD`). Dates within the 16-day window come from the standard forecast; dates
      further out are filled from OpenWeather's `day_summary` estimate. Past dates fetch
      nothing and show a note prompting the user to unpin.
    - The home location's today + 15 days are a rolling, derived view — not
      `TrackedForecast` rows. Only explicitly pinned dates are registry rows.
    - Untracking a location-date deletes only its `TrackedForecast` row; past
      `WeatherCheck` rows are kept.
    - Searching a location should asynchronously provide location suggestions from
      OpenWeather's geocoding API. Autocomplete should debounce to avoid unnecessary
      calls. Any city on the globe is allowed (results show city, state/region, country).
    - View can be toggled between day temperature, night temperature, and rain amount
      (`mockups/weather-rain.png`).
    - Each date carries a day temperature and a night temperature in one `WeatherCheck`
      row (no separate day/night rows).
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
- Weather: OpenWeather API (`OPENWEATHER_API_KEY`, `units=imperial` on every call so
  temperatures come back in Fahrenheit; precipitation is always mm regardless).
  Global coverage. Needs an active "One Call by Call" subscription (1000 calls/day
  included, then ~$0.15 per 100, no hard cap).
    - **Every tracked date — One Call 3.0 day summary**, one call per date:
      `GET https://api.openweathermap.org/data/3.0/onecall/day_summary?lat={lat}&lon={lon}&date={YYYY-MM-DD}&units=imperial&appid={key}`
      Use `temperature.afternoon` (day), `temperature.night` (night),
      `precipitation.total` (mm). day_summary covers near-future dates (live forecast
      aggregate) as well as long-range (statistical estimate), so it's the single
      source. Fetch a location's dates in parallel server-side.
    - The standalone "Daily Forecast 16 Days" (`data/2.5/forecast/daily`) would cut
      the home window to one call, but it's a separate paid product the key doesn't
      carry (401s). Revisit if that subscription is added — `source` on each
      `WeatherCheck` already marks in-horizon vs long-range.
    - `source` = `"forecast"` when the date is within `HOME_WINDOW_DAYS`, `"summary"`
      when it's further out. (Same endpoint either way for now; the field records the
      horizon so the UI can badge long-range dates as estimates.)
- Geocoding: OpenWeather Geo API
    - `GET https://api.openweathermap.org/geo/1.0/direct?q={query}&limit={n}&appid={key}`
    - Response entries carry `name`, `lat`, `lon`, `country`, optional `state`. Display
      as "City, State, Country"; store `{ name, latLong }` on the `WeatherCheck` /
      `TrackedForecast` / `homeLocation` setting.

## Decisions

- **Cloud sync → v2.** v1 is IndexedDB-only; server actions stay pure API proxies (no
  accounts, no server-side persistence). Clearing browser data wipes v1 history.
- **Weather provider is OpenWeather** (was NWS). Global — any city on the globe.
  Lifts the US-only and ~7-day limits.
- **Weather values: day temp, night temp, rain amount.** `rainProb` (NWS probability)
  → `rainAmt` (OpenWeather precipitation total, mm stored / inches shown). Sky
  condition dropped entirely. `WeatherCheck` no longer splits a date into day/night
  rows — one row per date with both temps.
- **16-day home window** (`HOME_WINDOW_DAYS = 16`). Every tracked date is fetched via
  One Call 3.0 `day_summary` (one call each); dates past the window are long-range
  estimates. The standalone 16-day daily endpoint isn't on the key. **Past-dated pins
  fetch nothing** — the row sits there with a "past date — unpin when done" note.
- **Fahrenheit by default** — `units=imperial` on every OpenWeather call.
- **Rolling weather window stays derived.** Only date+location pairs the user actively
  adds become `TrackedForecast` rows; the home location's today + 15 days are never
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
- OpenWeather's 16-day daily forecast and One Call 3.0 endpoints need an active paid
  subscription on the API key. If a call 401/402s, surface a clear "subscription
  required" message the way the Alpaca-keys path does.
- Past-date pins are inert (no fetch, just a note). Could auto-expire them instead of
  waiting for a manual unpin — deferred.

## Milestones

1. Scaffold Next.JS app
2. Data layer: IndexedDB stores (per `schema.md`) behind the `lib/store.ts` data-access
   module with a `LocalStore` implementation; export / import-JSON built on it
3. Commit init work to a GitHub remote repo
4. Iterate using puppeteer
5. Deploy to Vercel and test out first draft
