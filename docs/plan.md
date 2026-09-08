# Last I Checked — Plan

## Summary

Show history of your stock prices, weather forecasts, and sportsbook odds compared to
when you last checked them.

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
- `SportsbookCheck` tracks one sportsbook odds `Outcome` (point spread, moneyline,
  total, player prop, or a futures/award price) over time, matched to its
  `TrackedSportsbook` registry row by a `trackKey` value tuple. Its own page; full
  design in `docs/sportsbook.md`.
- The `StockCheck` / `WeatherCheck` stores are **append-only** in normal use: a fetch
  only inserts rows. Pruning old history is a later concern (see Open Questions).
- What the user is *currently tracking* lives in separate **registry** stores
  (`TrackedStock`, `TrackedForecast`, `TrackedCustom`, `TrackedSportsbook`) plus a
  `Setting` store for the home location.
  Adding an item writes a registry row; "untracking" deletes only that registry row —
  the check history stays, so re-adding the same symbol or location-date later brings
  its past checks back into the graph. History is matched to an item by value
  (`symbol`, `(location, dateStr)` where `dateStr` is `YYYYMMDD`, custom `name`, or
  sportsbook `trackKey`), not by an id.
- These two objects exist independently and are not related. They live on their own,
  separate pages.

## Delta baseline

The point of the app is "what changed since last I checked" — but a manual Fetch button
means the user can check many times in a short span, and comparing each check against the
immediately previous one dilutes the delta to noise (`+0.02 since 12 seconds ago`).

**Bucket the history, then compare bucket-to-bucket.**

- A **bucket** is one distinct calendar day for stocks and custom checks, or one
  distinct half-day (split at local noon) for weather and sportsbook. Weather
  forecasts for a fixed future date, and sportsbook lines, both genuinely move within
  a day, so they get the finer bucket; stock price at this app's altitude does not.
- A bucket's **value** is its *last* check ("where it stood when I left off"). Re-fetching
  within the current bucket updates that value in place — it does not add a bucket — so
  mashing Fetch cannot move the deltas.
- A bucket's **delta** is its value minus the next-older populated bucket's value.

**Presentation.** Show the recent buckets as a row of columns, newest on the left.
The column header is three rows: a **relative-day** label (`today`, `2 days ago`) over
an **absolute date** (`9/1`, or `9/4 PM` for a half-day bucket) over the **time of the
latest check** in that bucket (`10:51PM`). When adjacent columns are half-day buckets
of the same calendar day, the relative label is one merged cell spanning them. The
delta sits under the value:

```
|         today          | 2 days ago |
|  9/4 PM   |   9/4 AM    |    9/2     |
|  10:51PM  |   7:03AM    |   3:15PM   |
|  77(-4)   |    81       |    79      |
```

The absolute row removes the "two columns both say today" ambiguity that a
relative-only header had; the relative row keeps the baseline self-evident — `-4`
under `9/4 PM` next to `9/4 AM` reads as "down 4 since this morning". Hover/tap a delta
to spell it out. The oldest shown column, and any item's first-ever check, show a value
with no delta. Implemented in `lib/matrix.ts` (`unionAxis` / `relDaySpans`) +
`components/{CheckMatrix,WeatherMatrix}.tsx`; `lib/buckets.ts#bucketLabel` is the
shared `M/D [AM|PM]` formatter and `lib/format.ts#formatClock` the `10:51PM` one.

- `rainAmt` is a quantity of rain for the date (OpenWeather precipitation total).
  OpenWeather always returns precipitation in **mm** even with `units=imperial`; the UI
  converts to inches for display.
- Weather has four numbers per date — day temp, night temp, rain amount, wind speed —
  surfaced via a Temp / Rain view toggle (Temp splits into Day/Night lanes; Rain splits
  into Rain/Wind Speed lanes, both using the same AM/PM-style lane-label pattern). Each
  is a plain number with a numeric delta.
- The single-item detail page still plots **every raw check** on its graph; the columnar
  view is the list/home-screen summary. Every detail page also carries its own
  columnar strip — titled **"By day, latest"** (stocks, custom) or **"By half-day,
  latest"** (weather, sportsbook) — where each card shows the bucket's date, the time
  of that bucket's latest check, the value, and the delta; and a **Full history**
  table of every raw check, newest first.
- How many columns: a few on the list view, more on the detail page (exact counts TBD
  against the mockups).

_Alternative considered:_ baseline = "most recent check at least N hours old" (N ≈ 18 for
stocks, ≈ 6 for weather) instead of calendar buckets. Avoids a midnight cliff and handles
sparse history smoothly; loses the clean day-column model. Start with buckets; revisit if
the cliff feels wrong in practice.

## Screens / Flows

- Weather page
    - Assuming the home location is set, by default, today's date and each of the 9 days
      following it are rendered onto the screen — a rolling 10-day window.
      (`mockups/weather-home.png`)
    - Any date for any location (i.e. location-date pair) can be added for tracking
      (`mockups/weather-add.png`). This writes a `TrackedForecast` row (`forecastDate` =
      `YYYYMMDD`). Dates within the 10-day window come from the timeline forecast; dates
      further out are filled from OpenWeather's `day_summary` estimate. Past dates fetch
      nothing and show a note prompting the user to unpin.
    - The home location's today + 9 days are a rolling, derived view — not
      `TrackedForecast` rows. Only explicitly pinned dates are registry rows.
    - Untracking a location-date deletes only its `TrackedForecast` row; past
      `WeatherCheck` rows are kept.
    - Searching a location should asynchronously provide location suggestions from
      OpenWeather's geocoding API. Autocomplete should debounce to avoid unnecessary
      calls. Any city on the globe is allowed (results show city, state/region, country).
    - View can be toggled between day/night temperature and rain/wind speed
      (`mockups/weather-rain.png`). The Temp graph on the detail page plots day and
      night as two lines sharing one axis (hover shows both); the Rain graph plots
      rain and wind speed on **separate Y axes** (different units — inches vs. mph)
      sharing one time axis, wind speed in the same secondary color/dash convention
      as the night-temp line.
    - Each date carries a day temperature, night temperature, rain amount, and wind
      speed in one `WeatherCheck` row (no separate rows per metric).
    - Click into a single day view, and you can see a graph of the most recent checks
      you've made for that day/location. (`mockups/weather-day-page.png`) Below the
      Temp and Rain/Wind graphs, each gets a **"By half-day, latest"** column strip
      (per bucket: date, time of that bucket's latest check, value, delta) and the
      page ends with a **Full history** table (When · Day · Night · Rain · Wind).

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
      you've made for that stock. (`mockups/stocks-symbol-page.png`) Plus a **"By day,
      latest"** column strip (date · time of that day's latest check · price · delta)
      and a **Full history** table (When · Price).

- Custom checks page
    - Lets a user monitor any value on any page: provide a unique **name**, a **URL**,
      and a **CSS selector** pointing at where the value sits on that page. Assumes an
      advanced-Chrome-user audience — finding a selector means opening devtools, which
      needs a desktop browser. That's only a constraint on *creating* a check; running
      an existing one works from any device, since the fetch itself runs server-side
      (see Technical Approach below).
    - **Consolidated table, same shape as Stocks/Weather**: one row per tracked check,
      shared date-column axis, last 4 days shown (declutter — full history lives on the
      detail page). Each row still carries its **own Fetch** button in the row-label
      cell rather than one page-level bulk button — a headless-browser fetch can take up
      to ~30s, so batching many behind one shared button would block the page on the
      slowest one. Fetching stays **asynchronous per check**: clicking Fetch kicks off
      the job server-side and returns immediately, so the user can trigger another
      check's fetch (or navigate away) while it runs.
    - **Only numeric checks go in the matrix.** A long text value would distort every
      other row's column width in a shared-column table, so text-valued checks are
      kept out of it entirely and instead each get their own standalone card (name,
      Fetch button, own history table) below the matrix — same as the very first
      version of this page, before the matrix view existed. A bucket in the matrix
      only reflects a **successful** fetch — an errored fetch contributes no value to
      that row's columns.
    - **Delta precision: 5 decimal places, hard cap** (`CUSTOM_DELTA_DIGITS` in
      `lib/customColumns.ts`). Two beyond common fine-grained cases like batting
      average (`.312`) and win percentage. Deltas render with trailing zeros
      trimmed (`+0.003`, not `+0.00300`) via `<Delta trimZeros>`. The raw value is
      still shown at full precision.
    - Errored fetches are surfaced in a separate **Recent errors** table below the main
      one (check name, timestamp, error message), not inline in the value columns.
      Long error text stays on one line and scrolls horizontally rather than wrapping
      or getting truncated with an ellipsis.
    - Each tracked check has its own **detail page** (`/custom/[name]`, mirroring
      `/stocks/[symbol]`): a graph of every raw numeric check (omitted for text-valued
      checks, or when there are fewer than 2 points — same rule as Stocks), a "by day"
      horizontally-scrollable column strip, and a full reverse-chronological history
      table that includes error rows (unlike the home-page table, since debugging one
      check's failures is exactly what this page is for).

- Sportsbook page
    - Tracks a single sportsbook number — one Odds API `Outcome` (point spread,
      moneyline, total, player prop, or a futures/award price like MVP odds) — over
      time, compared only to that check's own earlier values (never book-vs-book).
      **Full design: `docs/sportsbook.md`.**
    - Not a sportsbook wrapper: no odds board / standings browsing. The user arrives
      having already seen a number at a real book and uses a drill-down —
      **sport → event → market**, plus a **region** selector (default `us`) — to
      re-find it. Sport / event / market are searchable fuzzy-filter comboboxes over
      already-loaded lists.
    - Sport and event lists come from The Odds API's free (0-credit) `/sports` and
      `/events` endpoints. Picking a market fires **one** `GET event odds` call
      (1 credit — one market, one region); its `bookmakers[] → markets[] →
      outcomes[]` are flattened and shown grouped by bookmaker. The user
      multi-selects one or more `(bookmaker, outcome)` rows to pin — the same outcome
      at several books is several independent checks. New checks seed their first
      value from that same response.
    - **Consolidated view, same shape as Stocks/Weather/Custom**: home groups pinned
      outcomes into `(event, market, region)` sections, each with one Fetch button
      that refreshes every check under it in a single 1-credit call. Half-day buckets
      for the delta baseline (odds move intraday, like weather forecasts).
    - An outcome with a `point` (spread / total / prop) is shown as **two lanes** —
      **Line** (the `point`, 1 dp) and **Odds** (American `price`, 0 dp) — each with
      its own plain arithmetic delta, like the weather table's AM/PM split.
      Moneyline / futures outcomes show a single Odds lane.
    - A check goes `closed` once its event's `commence_time` passes — Fetch disabled,
      value frozen. The app stays out of live/in-play betting.
    - Detail page `/sportsbook/[id]`, mirroring `/stocks/[symbol]` and
      `/custom/[name]`.

## Data

_High-level only; details go in `docs/schema.md`._

- Stored in IndexedDB (`last-i-checked`)
- Stores: append-only checks (`StockCheck`, `WeatherCheck`, `CustomCheck`,
  `SportsbookCheck`) + registry (`TrackedStock`, `TrackedForecast`, `TrackedCustom`,
  `TrackedSportsbook`) + `Setting` (home location)
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
    - **Dates within the 10-day window — One Call 4.0 timeline (1-day step):**
      `GET https://api.openweathermap.org/data/4.0/onecall/timeline/1day?lat={lat}&lon={lon}&units=imperial&appid={key}`
      One call returns exactly 10 days, `data[0]` = today. Each `data[x]` has `dt`
      (00:00 UTC of the forecast date — take year/month/day from the **UTC** date
      regardless of the request point), `temp.day`, `temp.night`, `rain` (mm, absent
      ⇒ 0), `wind_speed` (mph — flat field, verified against a live call). `source:
      "forecast"`.
    - **Dates past the 10-day window — One Call 3.0 day summary**, one call per date:
      `GET https://api.openweathermap.org/data/3.0/onecall/day_summary?lat={lat}&lon={lon}&date={YYYY-MM-DD}&units=imperial&appid={key}`
      Use `temperature.afternoon` (day), `temperature.night` (night),
      `precipitation.total` (mm), `wind.max.speed` (mph — nested differently than the
      timeline endpoint's flat `wind_speed`, verified against a live call). `source:
      "summary"`.
    - Per tracked date: within `HOME_WINDOW_DAYS` ⇒ take it from the single timeline
      call; further out ⇒ one `day_summary` call each (in parallel per location).
      Past dates fetch nothing.
- Geocoding: OpenWeather Geo API
    - `GET https://api.openweathermap.org/geo/1.0/direct?q={query}&limit={n}&appid={key}`
    - Response entries carry `name`, `lat`, `lon`, `country`, optional `state`. Display
      as "City, State, Country"; store `{ name, latLong }` on the `WeatherCheck` /
      `TrackedForecast` / `homeLocation` setting.
- Sportsbook: The Odds API (`ODDS_API_KEY`). Free "Starter" tier — 500 credits/month,
  no card; same markets as paid. Credit cost on odds endpoints is
  `1 × markets × regions`; `/sports` and `/events` cost 0. See `docs/sportsbook.md`
  for the full flow, market map, and error handling.
    - **Sport list (0 credits):**
      `GET https://api.the-odds-api.com/v4/sports?apiKey={key}`
      Every `active` entry offered (not curated); `has_outrights` marks
      futures/award "sports" (no events, `outrights`-only), `group` keys the
      player-prop market map.
    - **Event list (0 credits):**
      `GET https://api.the-odds-api.com/v4/sports/{sportKey}/events?apiKey={key}&dateFormat=iso`
      — `id`, `commence_time`, `home_team`, `away_team`. Event name =
      `` `${away_team} @ ${home_team}` ``.
    - **Event odds (1 credit — one market, one region):**
      `GET https://api.the-odds-api.com/v4/sports/{sportKey}/events/{eventId}/odds?apiKey={key}&regions={region}&markets={marketKey}&oddsFormat=american&dateFormat=iso`
      Returns `bookmakers[] → markets[] → outcomes[]`; also the Fetch-button call.
      Featured markets (`h2h` / `spreads` / `totals`) use this same endpoint.
    - Key errors (401/402, `INVALID_KEY`…) surface a clear "Odds API key problem"
      message like the Alpaca path; `x-requests-remaining` is read for a
      credit-usage gauge.

## Custom URL Checks — Technical Approach

- **Why the fetch has to run server-side.** A browser can't load an arbitrary
  third-party URL and read its DOM directly from client code: cross-origin iframes are
  blocked by the same-origin policy, and a plain client `fetch()` to another origin
  fails CORS before HTML parsing even starts. This runs as a server action / route
  handler — the same seam as the Alpaca and OpenWeather proxies in `lib/actions/`.
- **Headless browser, not a static fetch+parse.** Chosen over a lightweight
  HTML-parse-only approach so it works uniformly whether the value is present in the
  initial HTML or filled in by client-side JS (e.g. a live-updating ticker) — one code
  path, not a "try static, fall back to a browser" split.
    - `playwright-core` + `@sparticuz/chromium` (a serverless-compatible Chromium
      build), used the same way in local dev and on Vercel, so there's no separate
      dev-only "real Playwright" path to maintain.
- **Fetch pipeline:**
    1. `page.goto(url, { timeout })`
    2. `page.waitForSelector(selector, { timeout })` — this *is* the "wait for initial
       JS" step. It waits for the specific value to exist rather than guessing when the
       page is generally "done," so no separate `networkidle` wait is needed.
    3. Read `.textContent()` off the matched element, parse it per the check's value
       type (number vs. text), and write a `CustomCheck` row.
    4. Any failure (navigation timeout, selector never appears, bot-blocked page) is
       stored as `status: "error"` with a message — a failed fetch shows on the card
       rather than silently vanishing.
- **Data model** (append-only history + registry, same shape as Stocks/Weather —
  see `schema.md` for full record shapes):
    - `TrackedCustom` — PK'd on `name` (unique, user-provided), plus `url`, `selector`,
      `valueType`
    - `CustomCheck` — matched to its tracked item **by `name`, not a foreign key**
      (same convention as `StockCheck.symbol` / `WeatherCheck.location+dateStr`, so
      untrack → re-track resurfaces old history). Snapshots `url`/`selector`/
      `valueType` at fetch time, plus `rawText` (always kept, so a selector that
      starts returning garbage is debuggable), parsed `value`, `status`,
      `errorMessage`
- **SSRF guard.** The server is fetching whatever URL a user types in, so before
  navigating, resolve the hostname and reject private/link-local ranges
  (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and especially
  `169.254.0.0/16` — the cloud metadata endpoint).
- **Vercel function config.** Set `maxDuration` and `memory` explicitly on this route
  rather than relying on project defaults. Fluid Compute's default max duration (300s,
  every plan including Hobby) already covers a worst-case ~30s scrape, but a real
  Chromium instance is memory-hungry enough that the default memory allocation is worth
  overriding too.
- **`outputFileTracingIncludes` is required for both browser packages on
  Vercel.** Next's build-time file tracer (`@vercel/nft`) doesn't follow how
  either package locates its runtime assets, so without this config those
  files are silently dropped from the deployed function and the route
  500s/errors in **production only** — `next build` and local dev both work
  fine, so each of these was easy to miss until live:
    - `playwright-core` needs `browsers.json` (and a couple of other
      package-root files) — missing it throws `Cannot find module
      '.../playwright-core/browsers.json'`.
    - `@sparticuz/chromium` needs its whole `bin/` directory (the
      brotli-compressed Chromium binary, `chromium.br` etc.) — missing it
      throws `The input directory ".../\@sparticuz/chromium/bin" does not
      exist`, which reads like a bundler-externalization problem (and is,
      per the package's own README, when the cause is webpack) but here the
      cause is Vercel's file tracing, not bundling — `@sparticuz/chromium` is
      already on Next's built-in `serverExternalPackages` list, so it was
      never being bundled in the first place.
    Confirmed both via each route's `.next/server/app/**/route.js.nft.json`
    before/after: `browsers.json` and the four `bin/*.br` files were absent
    from the trace, then present once `outputFileTracingIncludes` named both
    `node_modules/playwright-core/**/*` and
    `node_modules/@sparticuz/chromium/**/*` for `/api/custom-check` and
    `/api/custom-check/suggest-selector` in `next.config.ts`.

## AI-Assisted Selector Suggestion — Technical Approach

Finding a CSS selector requires devtools, which assumes an advanced-Chrome-user
audience (see Custom checks page above). This feature lowers that bar: the user
gives a URL and describes the value in plain language ("the current stock
price"), and the app suggests a selector instead of requiring devtools.

**The core problem and why it doesn't need an agent.** A plain Claude API call
can't figure out a selector from a description alone — it has no access to the
rendered page. The naive fix (run Claude Code with a Puppeteer MCP server, e.g.
via `child_process` on a Linux box) works but is heavyweight: it requires a
persistent bash-accessible environment for the stdio MCP server, and turns a
one-shot lookup into a full agentic session. The fix is to **separate driving
the browser from reasoning about the page** — the app already runs Playwright
server-side (for the scrape route); reuse it to extract the page's content as
plain text, and give a single, ordinary Messages API call the job of matching
the description against that text. Claude never touches the browser.

**Pipeline** (new route handler, e.g. `app/api/custom-check/suggest-selector`,
alongside the scrape route and sharing its `launchBrowser()` / SSRF guard):

1. **Deterministic candidate extraction** — a self-contained function run via
   `page.evaluate()` (`lib/extractCandidates.ts`), no LLM involved:
   - Walk visible, text-bearing elements under `<body>` (checks computed
     `visibility`/`display`/`opacity` and a non-zero bounding rect; skips
     `<script>`/`<style>`/`<noscript>`/`<svg>` and `aria-hidden` nodes).
   - Drop a node if one of its children has the exact same text — that node is
     just a wrapper; keep the more specific descendant instead.
   - For each surviving node, synthesize a selector with the same fallback
     ladder DevTools uses: unique `#id` → unique `data-*`/`aria-*` attribute →
     unique `tag.class` combination → a structural `nth-child` path up from the
     node. Every selector is verified with `querySelectorAll(selector).length
     === 1` before being accepted, so nothing handed to the model is a guess.
   - Truncate each candidate's text (~100 chars) and cap the list (~200
     candidates) to keep the prompt small.
2. **One Messages API call**, `client.messages.parse()` with a Zod-constrained
   response (`{ index: number | null, confidence: "high" | "low" }`), given the
   page title, the user's description, and the numbered `{index, text}`
   candidate list (selectors are not sent to the model — unnecessary, and it
   only needs to pick a snippet). `output_config.effort: "low"` — this is a
   pick-one-from-a-list classification task, not a reasoning-heavy one.
   Model is `claude-sonnet-5`, not the app's default-to-Opus choice — cost
   scales with call volume here (every "Suggest selector" click), and this
   task shape (short list, structured output) doesn't need Opus-tier
   reasoning; verified the same three test cases (clean match, harder match,
   correct no-match) hold up identically on Sonnet 5.
3. **Server-side verification**, on the still-open page: re-resolve the chosen
   candidate's selector and confirm it still matches exactly one element
   before returning `{ selector, matchedText, confidence }`.
4. **UI**: the Add-check form gets a description field and a "Suggest
   selector" action that fills in the selector field (and shows the matched
   text) for the user to confirm or edit — never auto-saved without the user
   seeing what was picked. A `null` index (no confident match) surfaces as "try
   rephrasing, or use devtools" rather than a wrong guess.

**Example.** Given `<span data-testid="last-price">$254.32</span>` among other
elements, extraction produces a candidate like `{ index: 2, text: "$254.32",
selector: "[data-testid=\"last-price\"]" }`; the model only ever sees index 2
and the text `"$254.32"` next to the user's description, and returns `2`.

## Decisions

- **Cloud sync → v2.** v1 is IndexedDB-only; server actions stay pure API proxies (no
  accounts, no server-side persistence). Clearing browser data wipes v1 history.
- **Weather provider is OpenWeather** (was NWS). Global — any city on the globe.
  Lifts the US-only and ~7-day limits.
- **Weather values: day temp, night temp, rain amount.** `rainProb` (NWS probability)
  → `rainAmt` (OpenWeather precipitation total, mm stored / inches shown). Sky
  condition dropped entirely. `WeatherCheck` no longer splits a date into day/night
  rows — one row per date with both temps.
- **10-day home window** (`HOME_WINDOW_DAYS = 10`). In-window dates come from a single
  One Call 4.0 `timeline/1day` call (10 days, `data[0]` = today, dates keyed by the
  UTC `dt`); dates past the window use `day_summary`, one call each, marked as
  estimates. **Past-dated pins fetch nothing** — the row sits there with a "past date
  — unpin when done" note.
- **Fahrenheit by default** — `units=imperial` on every OpenWeather call; `°F` is
  also the storage unit (`WeatherCheck.tempUnit` is always `"F"`).
- **°C is a display-only preference** (Setting key `tempUnit`, `"F"` | `"C"`, chosen
  in Settings → Weather). Nothing about the fetch or the stored rows changes. When
  `"C"`: each raw °F value is converted to °C **before** bucketing, so the per-bucket
  value and the delta are both computed in °C (`numColumnsFor(checks, view, unit)` in
  `lib/weather-view.ts`); temperature values and deltas then render to 1 decimal
  place (0 dp for °F). Rain and wind are unaffected.
- **Rolling weather window stays derived.** Only date+location pairs the user actively
  adds become `TrackedForecast` rows; the home location's today + 9 days are never
  auto-pinned.
- **One data-access module** fronts all storage (see Data), so v2's cloud/sync layer
  swaps one implementation instead of rewriting call sites.
- **Export / import-JSON button ships in v1** — the only data-recovery path while there
  is no server copy, and the v2 migration on-ramp.
- **Sportsbook category** (4th, after Custom) — provider is The Odds API free tier;
  full design in `docs/sportsbook.md`. Drill-down uses the free `/sports` + `/events`
  endpoints; pinning and refresh use the 1-credit `GET event odds`. The `Outcome`
  object is the stored unit (hard dependency on the Odds API schema, accepted). Not a
  sportsbook wrapper — no discovery/browse UI. Stays out of live betting (checks
  freeze at `commence_time`). Outcomes with a `point` show two lanes (Line + Odds),
  each with its own arithmetic delta. Each browser gets 7 trial credits/month against the
  shared `ODDS_API_KEY` (tracked in `Setting`, resets monthly / on data-clear);
  past that the user pastes their own key in Settings → Sportsbook.

## Open Questions

- Sportsbook page is designed (`docs/sportsbook.md`); its remaining open questions —
  empty-response credit charging, MVP-futures key stability, decimal-vs-American
  default, credit-usage gauge, bucket granularity — are tracked there.
- **Autocheck** (scheduled per-category fetches + change notifications) —
  `docs/autocheck.md`. **Phases A + B shipped**: A = check-on-open
  (`components/AutocheckRunner.tsx`, Settings → "Schedule Your Checks", per-tab
  badge); B = installable PWA + provider route handlers (`app/api/{stocks,weather,
  sportsbook}`) + a bundled service worker (`sw/index.ts` → `public/sw.js`) whose
  `periodicsync` handler reuses the same tick core. Phase C (exact-time Web Push,
  needs the v2 server) is not done. Note: the autocheck fetch path now goes through
  route handlers, not Server Actions — `lib/actions/*` keep only the interactive
  calls.
- Pruning / retention for the append-only check stores — deferred; nothing prunes for
  now.
- Migrating storage to a cloud DB (MongoDB Atlas or similar) — revisit in v2 alongside
  cloud sync / accounts.
- OpenWeather's One Call 4.0 timeline and One Call 3.0 day_summary endpoints need an
  active paid subscription on the API key. If a call 401/402s, surface a clear
  "subscription required" message the way the Alpaca-keys path does.
- Past-date pins are inert (no fetch, just a note). Could auto-expire them instead of
  waiting for a manual unpin — deferred.
- Custom URL checks launch a fresh headless browser on every fetch. Fluid Compute reuses
  warm instances, so a module-level singleton browser (reused across invocations on the
  same warm instance, new `BrowserContext` per fetch) could skip the launch cost on warm
  hits — deferred until launch-per-invocation proves too slow in practice.

## Milestones

1. Scaffold Next.JS app
2. Data layer: IndexedDB stores (per `schema.md`) behind the `lib/store.ts` data-access
   module with a `LocalStore` implementation; export / import-JSON built on it
3. Commit init work to a GitHub remote repo
4. Iterate using puppeteer
5. Deploy to Vercel and test out first draft
6. Sportsbook category per `docs/sportsbook.md` — Odds API proxy in `lib/actions/`,
   `TrackedSportsbook` / `SportsbookCheck` stores, drill-down + `(event, market,
   region)` section view
