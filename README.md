# Last I Checked

How your stocks and weather have changed **since the last time you checked** — not
absolute numbers, but "AAPL is +$3 since Monday" and "tomorrow's high dropped 7°
since this morning".

Local-first: every "check" is stored in IndexedDB (`last-i-checked`) in your browser.
See [`docs/plan.md`](docs/plan.md) and [`docs/schema.md`](docs/schema.md) for the design.

## Run it

```bash
npm install
cp .env.example .env.local   # optional — fill in keys, see below
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build`, `npm test` (bucketing logic), `npm run typecheck`.

## API keys

| Feature | Needs | Without it |
| --- | --- | --- |
| **Weather + city search** (OpenWeather) | `OPENWEATHER_API_KEY` | Weather page loads; fetch/search show a "key not set" message |
| **Stocks** (Alpaca) | `ALPACA_API_KEY_ID` + `ALPACA_API_SECRET_KEY` | Stocks page loads; add/fetch show a "keys not set" message |

Restart the dev server after editing `.env.local`.

The OpenWeather 16-day forecast and One Call 3.0 `day_summary` endpoints require an
active paid subscription on the key (the "One Call by Call" plan — 1000 calls/day
included, then ~$0.15 per 100). A 401/402 surfaces a "subscription required" message.

## How it works

- **Registry vs. history.** `TrackedStock` / `TrackedForecast` are what you track now;
  untracking deletes only the registry row. `StockCheck` / `WeatherCheck` are
  append-only — each fetch inserts rows, matched back to an item by value.
- **Delta baseline.** History is bucketed (one calendar day for stocks, one half-day
  for weather); a bucket's value is its last check, and each column's delta is vs. the
  next-older column. Mashing *Fetch* can't dilute the deltas. See `lib/buckets.ts`.
- **Weather.** OpenWeather, global. A rolling 16-day home window from the daily
  forecast; pinned dates further out come from `day_summary` estimates. Each date has
  a day temp, night temp, and rain amount (mm stored, inches shown).
- **Storage seam.** Everything goes through `lib/store.ts` (`Store` interface,
  `LocalStore` impl). v2's cloud sync swaps the implementation, not the call sites.
- **Backup.** Settings → Export/Import JSON. The only recovery path in v1.

## Layout

```
app/            routes (stocks, stocks/[symbol], weather, weather/day, settings)
components/      CheckMatrix, DeltaColumns, CheckGraph, FetchBar, LocationSearch, …
lib/
  db.ts         Dexie schema — source of truth for stores/indexes
  store.ts      data-access module (the v1/v2 seam)
  buckets.ts    delta bucketing + tests
  fetchers.ts   "Fetch" button orchestration
  actions/      'use server' proxies: Alpaca (stocks), OpenWeather (weather + geocoding)
docs/           plan.md, schema.md, design.png, mockups/
```
