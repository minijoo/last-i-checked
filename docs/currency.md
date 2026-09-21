# Currency — Design

> **Status: implemented (2026-09-21).** Deviations from the plan are listed under
> "Implementation notes" at the bottom. Fifth tracked category, alongside Stocks, Weather,
> Custom URL checks, and Sportsbook. Modeled on Stocks: same Fetch flow, same
> one-day bucketing, same matrix. Differences are the input (two dropdowns, not a
> free-text ticker), the row header (`USD → EUR`), and a new pair of record types.

## Summary

- The user tracks an **exchange rate between two currencies** — a *base* and a
  *target* — and sees how it moved since the last day they checked, under the app's
  standard contract: each check is compared to *that pair's own* earlier checks,
  bucketed by calendar day. Never pair-vs-pair.
- Like Stocks, one number per check (the rate). Unlike Stocks, the input space is a
  **small closed set** (~30 currencies), so entry is two dropdowns instead of typing
  and validating a ticker.
- Deliberately **not** a currency converter. No amount field, no cross-rate table, no
  history charts pulled from the provider — the app's own check history is the only
  history (same rule as every other category).

## Goals

- Add a pair in two picks: base (defaults to USD) and target (user must choose).
- See at a glance whether each pair's rate went up or down since last checked, and by
  how much, in a table that stays narrow enough for a phone.

## Non-Goals

- Not a converter or a rate-history browser. Frankfurter offers historical and
  time-series endpoints; we never call them ("data is always current; history is your
  own checks" — `plan.md` Core Concepts).
- Not crypto. Crypto pairs are handled on the Stocks page (Alpaca `BTC/USD`); this
  page is fiat only.
- Not intraday. The provider publishes one rate per business day (see below), so a
  finer bucket would only repeat the same number.

## Core Concepts

- **The pair is the unit.** A tracked item is `(base, target)`. Direction matters:
  `USD → EUR` (how many EUR one USD buys) and `EUR → USD` are different rows with
  different, non-reciprocal deltas, and both can be tracked at once. The by-value
  match between registry and history is the joined string `pair` = `"USD/EUR"`
  (same convention as `StockCheck.symbol`), so untrack → re-track resurfaces history.
- **`rate` means "1 base = `rate` target".** Exactly what Frankfurter returns for
  `base=USD&symbols=EUR`. An *up* delta means the base got stronger against the
  target. That direction is fixed by how the row header reads (`USD → EUR`), so no
  inversion toggle in v1.
- **Append-only checks + registry**, same as the other categories: `CurrencyCheck`
  rows are only ever inserted; `TrackedCurrency` holds what's tracked right now;
  untracking deletes only the registry row.
- **New record types, not a reuse of `StockCheck`.** A check needs *two* identifying
  fields plus provenance (`rateDate`), and the row header, detail route, and number
  formatting all differ. Reusing `StockCheck` with a `"USD/EUR"` symbol would leak
  into stock-only paths (the Alpaca fetch and ticker validation).
  The shared parts — bucketing, matrix, delta toggle, graph — are already generic
  over `{ checkedAt, value }` and get reused as-is.

## Provider — Frankfurter

<https://frankfurter.dev> · public, **no API key**, no env var, no credit accounting.
Data are the European Central Bank's reference rates.

- **Currency list:** `GET https://api.frankfurter.dev/v1/currencies` →
  `{ "AUD": "Australian Dollar", "BRL": "Brazilian Real", … }` (~30 entries, includes
  `USD` and `EUR`). Populates both dropdowns. Fetched by a route handler with a 24 h
  cache (`next: { revalidate: 86400 }`) — the set changes roughly never.
- **Latest rates:** `GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP`
  →
  ```json
  { "amount": 1.0, "base": "USD", "date": "2026-09-18",
    "rates": { "EUR": 0.8726, "GBP": 0.74939 } }
  ```
  `rate = rates[target]`; `rateDate = date`.
- **One request per distinct base**, not one per pair and not one bulk call:
  Frankfurter takes a single `base` per request but many `symbols`. Tracking
  `USD/EUR, USD/GBP, EUR/JPY` = 2 requests (`base=USD`, `base=EUR`), fired in
  parallel. (Alternative considered: one `base=USD` call and derive cross rates by
  division. Rejected — the derived number wouldn't match what the provider publishes
  for that pair, and it rounds twice.)
- **One rate per business day.** ECB rates publish once a day (~16:00 CET,
  business days only). Weekend/holiday fetches return the last published `date`.
  Consequences:
  - Several fetches in a day usually return the *same* rate, so a `+0.0000` delta is
    normal, not a bug. Same-day dedup is already handled by bucketing (last check
    of the day wins).
  - `rateDate` is stored on every check so a flat Saturday is explainable ("as of
    Fri 9/18"). The matrix is still bucketed by `checkedAt`, matching Stocks.
- **Errors.** No key-missing path. Non-2xx → `Frankfurter responded {status}`;
  network error → the message; a target absent from `rates` → "No rate returned for
  USD/XXX." (same shape as the stocks "No price returned" line).

## Data model

Full shapes in `docs/schema.md`. Summary:

```ts
interface TrackedCurrency {   // registry
  pair: string;               // PK, "USD/EUR"
  base: string;               // ISO 4217, "USD"
  target: string;             // "EUR"
  addedAt: number;            // epoch ms
}

interface CurrencyCheck {     // one row per fetch, per pair; append-only
  id: number;
  checkedAt: number;          // epoch ms
  pair: string;               // matches TrackedCurrency.pair
  base: string;
  target: string;
  rate: number;               // 1 base = rate target
  rateDate: string;           // "YYYY-MM-DD" — Frankfurter's `date` (ECB publish day)
}
```

`base` / `target` are snapshotted on the check (as `WeatherCheck` snapshots
`location`) so a row is interpretable without the registry. New stores need a
**Dexie `version(2)`** — `db.ts` is currently a single `version(1)`, and editing it
would not create the stores in browsers that already have the DB. Additive only, no
upgrade function.

## Screens / Flows

### Nav

A fifth tab in `PageSwitcher`, icon-only like the others: `<MdCurrencyExchange />`
(`react-icons/md`), `aria-label="Currency"`, route `/currency`. Placed **after
Stocks** (the two financial categories sit together): Stocks · Currency · Weather ·
Sportsbook · Custom. Home still redirects to `/stocks`.

### `/currency` — list page

Same layout as `/stocks`: title + blurb, **Fetch rates** button (`FetchBar` →
`runCurrencyFetch`), add form, then one `Card` with the matrix (`MatrixFrame
page="currency"`, `NumMatrix`), empty state, and the footnote about blank cells and
the `%` toggle.

- **Add form** (`components/AddCurrencyForm.tsx`, inline like `AddSymbolForm` — three
  controls fit one row): `[Base ▾]` `→` `[Target ▾]` `[Add]`.
  - Both dropdowns are the existing searchable `Combobox` (~30 items, type "yen" →
    JPY; reuses fuzzy match + keyboard nav). Option label `USD`, `hint` = full name
    ("US Dollar"); `search` includes the name. A native `<select>` is the fallback if
    the Combobox feels heavy for 30 items.
  - **Base** defaults to `USD`. **Target** starts empty with placeholder "Target
    currency"; **Add** is disabled until one is picked.
  - **Target excludes the current base**, and changing base to equal the chosen target
    clears the target (no `USD → USD`).
  - After a successful add the target clears and base stays, so adding several pairs
    against the same base is fast. Adding a pair that already exists is a no-op put
    (like `addTrackedStock`) with an "Already tracking" note.
  - Dropdown options come from the cached currency-list route; while it loads (or if
    it fails) the dropdowns are disabled with a small error line.
- **Row header** — compact, because the table's job is the number columns:
  `USD → EUR` in mono semibold (`LuArrowRight` between the codes), linking to
  `/currency/USD-EUR`, plus the `×` untrack button. The full names ("US Dollar → Euro")
  go in the link's `title` tooltip, not on screen. No sticky-column change: the label
  column is ~7 characters wide plus the arrow.
- **Number format.** Rates span 0.75 (GBP) to 17,000+ (IDR), so a fixed decimal count
  won't do. `formatRate(n)`: 5 significant digits, trailing zeros trimmed, thousands
  separators → `0.87260`, `1.4045`, `157.89`, `1,388.1`, `17,823` (`rateDecimals` =
  `4 − floor(log10 rate)` decimals, clamped 0–10). Deltas use the **same decimal
  places as the rate they belong to** (the matrix takes a per-cell `digits` function)
  so `+0.00123` sits under `0.87260` rather than rendering as `+0.00`. The shared `%`
  toggle works unchanged and is arguably the more useful view for FX.
- **Bucketing:** `Domain` gains `"currency"`, which falls through to the calendar-day
  case in `bucketKey` (one bucket per day, last check of the day wins) exactly like
  `"stock"` / `"custom"`.

### `/currency/[pair]` — detail page

Mirror of `/stocks/[symbol]`: the pair as the title (`USD → EUR`, full names as the
subtitle), Fetch button, `CheckGraph` of that pair's checks, and the per-check list
with `rateDate` shown as "as of" so flat weekend values are explained. `[pair]` is the
URL form `USD-EUR` (`/` can't appear in a path segment); parsed back to `USD/EUR`.

## Code map

| Piece | File |
|-------|------|
| Types | `lib/types.ts` — `TrackedCurrency`, `CurrencyCheck`, `CurrencyQuote`; `BackupBlob` gains optional `trackedCurrencies?` / `currencyChecks?` |
| Dexie | `lib/db.ts` — `db.version(2).stores({ trackedCurrencies: "pair, addedAt", currencyChecks: "++id, pair, checkedAt, [pair+checkedAt]" })` |
| Store | `lib/store.ts` — `getTrackedCurrencies` / `addTrackedCurrency` / `removeTrackedCurrency` / `appendCurrencyChecks` / `getCurrencyChecks(pair)` / `getAllCurrencyChecks`; include both stores in export / import / clear-all |
| Provider | `lib/providers/currency.ts` — pure fetch + parse (`fetchCurrencies`, `fetchRates`), no credentials |
| Routes | `app/api/currency/route.ts` (rates), `app/api/currency/currencies/route.ts` (list, cached) — route handlers, same reason as stocks (concurrent fetches don't serialize behind the Server Action dispatcher) |
| Fetch | `lib/fetchers.ts` — `runCurrencyFetch()`: group tracked by base → parallel requests → `appendCurrencyChecks` (dev-tool jitter/offset applies as for stocks) |
| Hooks | `lib/hooks.ts` — `useTrackedCurrencies`, `useAllCurrencyChecks`, `useCurrencyChecks(pair)`; `DeltaPage` gains `"currency"` |
| Format | `lib/format.ts` — `rateDecimals`, `formatRate` (+ unit tests in `lib/format.test.ts`) |
| UI | `components/AddCurrencyForm.tsx`; `app/currency/page.tsx`, `app/currency/[pair]/page.tsx`; `PageSwitcher` tab |
| Buckets | `lib/buckets.ts` — `Domain` += `"currency"` |
| Tests | `lib/format` rate/delta cases; `bucketKey("currency")`; provider parse (fixture JSON incl. weekend `date`, missing target) |

## Milestones

1. Types + Dexie `version(2)` + store methods + backup/clear coverage.
2. Provider + routes + `runCurrencyFetch`; verify with `curl` against the running dev
   server (`/api/currency?pairs=USD/EUR,USD/GBP,EUR/JPY`).
3. `formatRate` / `formatRateDelta` + tests.
4. `AddCurrencyForm` + `/currency` page + nav tab; verify via Puppeteer (add, fetch,
   re-fetch same day → same bucket, untrack keeps history).
5. `/currency/[pair]` detail page.
6. Fold into `plan.md` / `schema.md`; flip this doc's status banner to implemented.

## Open questions

- **Tab position.** Proposed after Stocks; trivially changeable.
- **Currency list fallback.** If `/v1/currencies` is unreachable the add form is
  disabled. A bundled static list would let the form work offline (fetches would still
  fail). Deferred; the list is tiny if we want it.
- **Inline vs drawer add form.** Inline like Stocks for now (one row). The other
  multi-field forms (Custom, Sportsbook, Weather pin) live in the bottom-sheet
  `Drawer`; revisit if the row wraps badly on narrow screens.
- **Inversion.** A per-row "flip" (`EUR → USD` from a tracked `USD → EUR`) would just
  be tracking the other pair; no toggle planned.
- **Provider drift.** Frankfurter's base URL is versioned (`/v1`); if it moves to a
  `/v2`, only `lib/providers/currency.ts` changes.

## Implementation notes / deviations

- **No `formatRateDelta`.** `NumMatrix` / `DeltaColumns` `digits` now also accept a
  `(value) => number`, so each cell's delta uses `rateDecimals(cell.value)`. `rateDecimals`
  is `4 − floor(log10 rate)` (5 significant digits, clamped 0–10), so GBP shows
  `0.74939`, not `0.7494`.
- **Unknown codes drop one base, not the batch.** Frankfurter 404s a whole request for
  an unknown base/symbol; `fetchRates` treats 404/422 as "no quotes for that base" so
  the caller's "No rate returned for …" line names the pair and other pairs still save.
- **`useCurrencyList()`** (`lib/currencyList.ts`) — one shared, module-cached fetch of
  `/api/currency/currencies` used by the add form and the row tooltips. The route sets
  `Cache-Control: public, max-age=86400` instead of a Next revalidate setting.
- **`Combobox` got a `listClassName` prop** (default `w-full`) so the currency
  dropdowns can list `USD  United States Dollar` without wrapping (`w-64`).
- **Dev-tool jitter uses `jitterCustom`** (5 dp), since `jitterValue` rounds to 2 dp
  and would flatten rates.
- Verified with Puppeteer: add via search ("yen" → JPY), multi-base fetch, deltas at
  per-rate precision, detail page + graph axis precision, and the Dexie v2 upgrade on
  an existing DB. Tests: `lib/format.test.ts`.
