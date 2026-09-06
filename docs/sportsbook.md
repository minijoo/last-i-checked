# Sportsbook — Design

> **Status: implemented.** `lib/actions/sportsbook.ts` (Odds API proxy),
> `lib/sportsbook.ts` + `lib/sportsbook/markets.ts` + `lib/fuzzy.ts` +
> `lib/sportsbookCredits.ts` (trial credits / BYO key),
> `components/{Combobox,AddSportsbookForm,SportsbookMatrix,SportsbookColumns,OddsDelta}.tsx`,
> `app/sportsbook/{page,[id]/page}.tsx`, a Sportsbook section in
> `app/settings/page.tsx`. Stores `trackedSportsbook` / `sportsbookChecks` in
> `lib/db.ts`. Odds-math unit tests in `lib/sportsbook.test.ts`. This doc is the
> design of record; a few small deviations are noted inline.

Fourth tracked category, alongside Stocks, Weather, and Custom URL checks. Tracks a
single **sportsbook number** — one odds `Outcome` (a point spread, moneyline, total,
player prop, or a futures/award price like MVP odds) — over time, under the app's
standard "what changed since last I checked" contract: every check is compared to
*that check's own* earlier values, bucketed; never book-vs-book, never against a
"true" line.

## Summary

- Like Stocks, the user pins a **specific** number they already care about. Unlike a
  ticker symbol, that number isn't a single searchable token — it's a coordinate
  (sport → event → market → outcome → bookmaker → region). The page's job is to help
  the user reconstruct that coordinate and pin the outcome(s) at it.
- The value that moves between visits is the outcome's `price` (and, for lined
  markets, its `point`). That pair has a uniform shape across every market, so one
  renderer and one delta path cover all of them.
- Deliberately **not** a sportsbook wrapper. No odds board, no standings, no
  "what's available tonight" browsing. The user is expected to arrive having already
  seen the number at a real book.

## Goals

- User can locate a number they saw at a sportsbook and pin it for tracking, in a few
  taps, without picking a bookmaker up front.
- User can pin the same outcome at several books at once, each as an independent
  check.
- User can see whether their pinned number moved since last they checked, which
  direction, and by how much — with the "how much" expressed so it stays meaningful
  across the whole American-odds range.

## Non-Goals

- Not odds comparison / line shopping. Multiple books can be pinned, but a check only
  ever compares to its own history.
- Not live / in-play betting. A check freezes at its last pre-game value once the
  event starts (see **Lifecycle**).
- Not discovery. No browsing of events or markets beyond the minimal drill-down
  needed to re-find a known number.

## Core Concepts

- **The `Outcome` is the unit.** The Odds API's `Outcome` object
  (`{ name, description?, price, point? }`) is what a `SportsbookCheck` stores and
  what the page renders. This is a hard dependency on The Odds API as the value
  source for this category, accepted deliberately. Room is left for schema drift: the
  raw `Outcome` JSON is kept on every check alongside the extracted fields.
- **Coordinate, not a token.** A pinned outcome is addressed by
  `sportKey · eventId · region · bookmakerKey · marketKey · outcomeName ·
  outcomeDescription`. That tuple is the by-value match between a `TrackedSportsbook`
  row and its `SportsbookCheck` history (same convention as `StockCheck.symbol` /
  `WeatherCheck.(location,dateStr)` / `CustomCheck.name`), so untrack → re-track
  resurfaces history.
- **Identity excludes `point`.** On refresh we get a fresh response and must map each
  fresh outcome back to the check it updates. The match key is
  `(bookmakerKey, marketKey, outcomeName, outcomeDescription ?? null)` — **`point` is
  deliberately left out**, because for standard markets that tuple is already unique
  per book, and `point` is frequently the thing that moves (a prop line drifting
  `o1.5 → o2.5`). Keying on `point` would drop the thread on a line move.
- **Alternate markets are excluded** (`alternate_spreads`, `player_*_alternate`,
  etc.). They carry many outcomes identical except for `point`, which breaks the
  identity key above. If they're ever added, `point` joins the identity key for those
  markets only.
- **Append-only checks + registry**, same as the other three categories:
  `SportsbookCheck` rows are only ever inserted; `TrackedSportsbook` holds what's
  pinned right now; untracking deletes only the registry row.

## Provider — The Odds API

<https://the-odds-api.com/>

- **Free "Starter" tier:** 500 credits/month, no credit card. Same markets as the
  paid tiers (h2h, spreads, totals, outrights; player props for selected
  sports/books).
- **Credit cost:** `1 × (# markets) × (# regions)` on the odds endpoints. The
  `/sports` and `/events` (event list without odds) endpoints cost **0**.
- **Upgrade path:** $30/mo → 20K credits, if real usage outgrows 500.
- On calls that 401/402 (bad or unsubscribed key), surface a clear
  "Odds API key problem" message the same way the Alpaca-keys path does. Read
  `x-requests-remaining` off responses so the UI can warn near the cap.

### Endpoints used

All calls go through a server action / route handler proxy (`lib/actions/`), same
seam as Alpaca and OpenWeather. `apiKey` is server-side only and is **never** stored
on a check — only a request-params template is.

- **Sport list** (0 credits, cached):

  ```
  GET https://api.the-odds-api.com/v4/sports?apiKey={key}
  ```

  **Not curated** — every entry with `active: true` is offered. Three fields on each
  entry drive the UI:
  - `has_outrights` — `true` marks a futures/award "sport" (e.g.
    `americanfootball_nfl_super_bowl_winner`, `basketball_nba_mvp` where offered).
    These have no events: the drill-down skips the event step and the only market is
    `outrights`. Discovered here, never hardcoded.
  - `group` — e.g. `"American Football"`, `"Basketball"`, `"Soccer"`. Groups the sport
    picker and keys the sport → player-prop-market map (see **Sports & markets**).
  - `title` / `description` — display.

  Cache the response; refresh periodically — seasonal futures sports come and go.

- **Event list for a sport** (0 credits):

  ```
  GET https://api.the-odds-api.com/v4/sports/{sportKey}/events?apiKey={key}&dateFormat=iso
  ```

  Each event: `id`, `commence_time`, `home_team`, `away_team`. Event name is derived
  as `` `${away_team} @ ${home_team}` ``. Futures "sports" have no events — that step
  is skipped and the odds call uses market `outrights`.

- **Event odds** (1 credit — one market, one region) — used for both the drill-down's
  final step *and* the Fetch button:

  ```
  GET https://api.the-odds-api.com/v4/sports/{sportKey}/events/{eventId}/odds
      ?apiKey={key}&regions={region}&markets={marketKey}
      &oddsFormat=american&dateFormat=iso
  ```

  Returns `bookmakers[] → markets[] → outcomes[]`. Featured markets (`h2h`,
  `spreads`, `totals`) come through this same endpoint, so there's one code path for
  every market type.

## Drill-down flow

The user picks, in order:

1. **Sport** — every `active` sport from `/sports` (cached), grouped by `group`.
2. **Event** — from `/events` for that sport. Rows show `` `${away} @ ${home}` `` and
   the local commence time. *(Skipped for futures sports — `has_outrights: true`.)*
3. **Market** — candidate list per **Sports & markets** below, validated lazily on
   selection (see **Market validation**).
4. **Region** — defaults to `us`; changeable (`us`, `us2`, `uk`, `eu`, `au`) but not
   foregrounded. Kept variable in the data model. One region per check to start;
   selecting several would multiply the credit cost.

### Pickers

Sport, event, and market are **searchable single-select comboboxes** — the lists run
long (60+ sports, a full event slate, dozens of prop markets). Each opens showing the
full list and filters as the user types; a choice commits the selection.

- **Client-side only.** Typing filters lists already in memory (`/sports` cached,
  `/events` for the chosen sport, the in-code market map). Nothing is fetched on
  keystroke.
- **Fuzzy match** (subsequence + light typo tolerance), scored and re-ranked
  match-as-you-type, against:
  - sport → `title`, `group`, `description`, `key` (so "nfl", "american football",
    and "americanfootball_nfl" all hit)
  - event → `home_team`, `away_team`, and the derived `` `${away} @ ${home}` ``
  - market → `label`, `key`
- **Sport picker keeps `group` headers** in both the full and filtered list (a header
  shows whenever a child matches).
- Keyboard navigable; "no matches" empty state. Region stays a plain select (five
  options). Matcher / component choice deferred to implementation.

Then the app fires **one** event-odds call (1 credit). The response is flattened to a
list of `Outcome`s **grouped by bookmaker** — every book in the region is shown, with
no bookmaker pre-selection. The user **multi-selects** one or more `(bookmaker,
outcome)` rows; each becomes a `TrackedSportsbook` row. The same outcome at several
books yields several independent checks.

The new checks' first value is **seeded from this same response** — we already have
it, so no immediate Fetch is needed. `previous` stays null until the next Fetch
establishes the first delta.

## Outcome rendering

The `Outcome` shape is constant across every market, so one row renderer serves all:

```
[description ·] name [· point] [· price]
```

| Market        | Example row                                  |
|---------------|----------------------------------------------|
| `h2h`         | `New England Patriots · -145`                |
| `spreads`     | `New England Patriots · -2.5 · -110`         |
| `totals`      | `Over · 45.5 · -105`                         |
| player prop   | `Patrick Mahomes · Over · 1.5 · -115`        |
| `outrights`   | `Patrick Mahomes · +900`                     |

- `description` (the player, for props and awards) is always shown when present.
- The shape is uniform but the field *semantics* differ (`name` is a team for h2h /
  spreads, an Over/Under for totals / props; `point` is a signed handicap for
  spreads, a line for totals / props, absent for h2h). The renderer stays uniform;
  the market label + event + region carry the context in the **section header**, not
  the row.

## Tracked value and deltas

The value that changes between visits is `{ price, point?, lastUpdate }` —
`lastUpdate` from `bookmaker.last_update`, falling back to `market.last_update`.
Because re-fetched outcomes have the same shape as prior fetches, both numeric fields
are diffable.

- **`point` delta** is linear and safe. Show `before → after` and a signed numeric
  delta with an arrow.
- **`price` delta (American odds)** must **not** be a raw subtraction. The American
  scale has a ~200-wide dead zone across ±100 and is non-linear, so `-110 → +105`
  reads as a 215-point swing for what is really a ~3.6pp move. Instead:
  - Convert both prices to implied probability and diff those:

    ```
    favorite (price < 0):  P = -price / (-price + 100)
    underdog (price > 0):  P =  100  / ( price + 100)
    ```

  - Arrow from `sign(P_now − P_prev)`; magnitude as "moved +2.1 pts" from the
    probability delta. Raw (with-vig) probability is fine for a movement signal — no
    need to de-vig.
  - **Always also show the literal `-110 → +105`** in the user's odds format
    (default American) — bettors read American odds natively and want the real
    numbers; the probability delta is the comparable summary, not a replacement.
  - Green/red (Up/Down) mapping of the arrow is a UI decision — TBD against mockups.
- **When `point` moved**, lead with the line move (`o1.5 → o2.5`) and treat the
  `price` delta as secondary context. A standalone price delta across a line change
  is meaningless — the market repriced around a new number.
- **Delta baseline / bucketing:** reuse the model in `plan.md` → *Delta baseline*.
  Odds move meaningfully within a day (like weather forecasts for a fixed date), so
  use the **half-day bucket** (split at local noon), not the stock-style calendar-day
  bucket. Confirm against mockups; the "most recent check ≥ N hours old" alternative
  noted for weather applies here too.

## Lifecycle

A check has a `status`, computed at render time (local-first; no background job):

| status        | when                                                        | Fetch button |
|---------------|------------------------------------------------------------|--------------|
| `active`      | before `commenceTime`, outcome still returned on fetches   | enabled      |
| `unavailable` | before `commenceTime`, but the outcome/market stopped coming back (book pulled or suspended it) | enabled (may return); row flagged |
| `closed`      | `commenceTime` has passed                                  | **disabled** |

`closed` is how the app stays out of live/in-play betting: once the event starts, the
check freezes at its last pre-game value. `commenceTime` is stored on the tracked row
so the transition needs no network call.

## Fetch button

**One Fetch button per `(eventId, marketKey, region)` section**, matching the batch
semantics exactly: that section's single event-odds call (1 credit) refreshes every
check in it, across all books, in one request.

- 5 tracked props across 2 books for one game = **1 credit per refresh**. This is what
  keeps the 500/month free tier viable.
- A section whose checks are all `closed` shows the button disabled.
- The response updates only the outcomes that are actually pinned; the rest of the
  payload is ignored.

## Data model

Canonical record shapes now live in `docs/schema.md` (record types + object-store
table); naming follows the existing `StockCheck` / `TrackedStock` pair. The shapes
below are kept here with inline rationale.

```ts
interface TrackedSportsbook {   // registry: one row per pinned outcome
  id: number;                   // auto-increment PK
  addedAt: number;              // epoch ms

  // re-fetch coordinates
  sportKey: string;             // "americanfootball_nfl"
  sportTitle: string;           // "NFL" — display
  eventId: string;              // "" for futures / outrights sports
  eventName: string;            // `${away} @ ${home}`, or the futures title
  commenceTime: number;         // epoch ms — drives `closed`
  region: string;               // "us" (default), variable
  marketKey: string;            // "player_pass_tds"
  marketLabel: string;          // "Player Pass TDs" — from curated list
  bookmakerKey: string;         // "draftkings"
  bookmakerTitle: string;       // "DraftKings"

  // outcome identity — stable fields only (no `point`)
  outcomeName: string;              // "Over"
  outcomeDescription: string | null; // "Patrick Mahomes" | null

  oddsFormat: "american";
  // The coordinates above ARE the refetch template — no apiKey is stored
  // (it lives server-side in the Odds API proxy). The URL is rebuilt there.
}
// `status` ("active" | "unavailable" | "closed") is derived at render from
// commenceTime + the latest check — it is not a stored column.

interface SportsbookCheck {     // append-only; one row per fetch per pinned outcome
  id: number;                   // auto-increment PK
  checkedAt: number;            // epoch ms
  trackKey: string;             // identity tuple joined (see below) — by-value match
  price: number | null;         // American (or decimal) odds; null if outcome absent this fetch
  point: number | null;         // line; null for h2h / when absent
  oddsFormat: "american" | "decimal";
  lastUpdate: number;           // epoch ms — bookmaker.last_update ?? market.last_update
  rawOutcome: unknown;          // raw Outcome JSON — schema-drift insurance / debugging
  status: "ok" | "unavailable"; // "unavailable" = fetch ok but this outcome wasn't in it
}
```

- `trackKey` =
  `sportKey|eventId|region|bookmakerKey|marketKey|outcomeName|(outcomeDescription ?? "")`.
  `point` is not part of it.
- Object stores follow the established pattern: `SportsbookCheck` keyed on `id`
  (autoIncrement) with indexes `trackKey`, `checkedAt`, `[trackKey+checkedAt]`;
  `TrackedSportsbook` keyed on `id` with `addedAt` and a
  `[eventId+marketKey+region]` index for section grouping.
- All access goes through the `lib/store.ts` data-access module — no direct
  Dexie/IndexedDB from components or actions.

## Screens

- **Home** — sections grouped by `(event, market, region)`, each with a header
  (`eventName · marketLabel · region · commence time / status`), the pinned outcome
  rows (grouped by bookmaker within the section), and one Fetch button. Half-day
  column strip per row, last few buckets, same columnar delta view as Stocks/Weather.
- **Add flow** — the drill-down above (sport → event → market → region → multi-select
  outcomes).
- **Detail page** (`/sportsbook/[id]`, mirroring `/stocks/[symbol]` and
  `/custom/[name]`) — graph of every raw check (plot `price` as implied probability so
  the line is continuous; `point` on a secondary axis when the market has one), a
  half-day column strip, and a full reverse-chronological history table including
  `unavailable` rows.
- No mockups yet (`docs/mockups/` currently has Stocks + Weather only).

## Sports & markets

**Sports — not curated.** Every `GET /v4/sports` entry with `active: true`, grouped by
its `group` field. `has_outrights` splits the two flows: outright sports → no event
step, `outrights` is the only market; game sports → `h2h` / `spreads` / `totals` +
player props, never `outrights`.

**Markets** shown at step 3, as *candidates* (validated on selection):

- **Featured, game sports:** `h2h`, `spreads`, `totals`.
- **Outrights, futures sports:** `outrights` only.
- **Player props** — appended for game sports from an in-code map keyed by `/sports`
  `group` (`lib/sportsbook/propMarkets.ts`), always offered (no pre-detection;
  validation catches what a sport/event doesn't carry). All prop keys for the group
  **except `alternate_*` / `*_alternate`**, sourced from
  <https://the-odds-api.com/sports-odds-data/betting-markets.html>:

  | `group` | leagues | props |
  |---|---|---|
  | American Football | NFL, NCAAF, CFL | all but alternate |
  | Basketball | NBA, NCAAB, WNBA | all but alternate |
  | Baseball | MLB | all but alternate |
  | Ice Hockey | NHL | all but alternate |
  | Soccer | all soccer leagues | all but alternate; the page's "Other soccer betting markets" subsection is excluded entirely |

  Market entry shape: `{ key, label, groups: string[] }`. Exact keys per group are
  enumerated at implementation time from the betting-markets page.

### Market validation

The market list is candidate-only. When the user selects a market, the event-odds
call resolves one of three ways:

| result | meaning | UI |
|---|---|---|
| `200`, `bookmakers` non-empty | normal | show the grouped outcome list |
| `200`, `bookmakers` empty | market key valid, but no book has posted it for this event (early futures, NCAAF props, suspended lines) | empty state — "No {marketLabel} lines posted for this event yet", **not** an error. A no-data response isn't charged (confirm this covers empty-market as it does no-events). |
| `4xx` + `error_code` | see below | mapped message |

| `error_code` | cause | UI |
|---|---|---|
| `INVALID_MARKET_COMBO` | featured/prop market on an outright sport, or `outrights` on a game sport. Prevented by respecting `has_outrights`; handled as a safety net. | "{marketLabel} isn't available for {sportTitle}" |
| `INVALID_MARKET` / `UNKNOWN_MARKET` | market key not recognized for this endpoint | same as above |
| `EVENT_NOT_FOUND` / `INVALID_EVENT_ID` | event settled or dropped | mark the event stale in the drill-down; from a Fetch, flip the check to `closed` |
| `OUT_OF_USAGE_CREDITS` | monthly 500 exhausted | "Odds API monthly limit reached" + credit gauge |
| `EXCEEDED_FREQ_LIMIT` (429) | > 30 req/s | back off and retry; not expected at this volume |
| `INVALID_KEY` / `MISSING_KEY` / `DEACTIVATED_KEY` | key problem | existing "Odds API key problem" path |

Optionally cache negative results (`sportKey|marketKey` → empty/invalid) so a
known-bad market greys out in the picker instead of being re-fetched; clear on a TTL.

## Decisions

- **Provider is The Odds API**, free Starter tier to start. Hard dependency on its
  `Outcome` schema, accepted; raw blob kept per check for drift tolerance.
- **No discovery UI** — drill-down only, entered after the user has found the number
  at a real book.
- **Sports not curated** — every `active` sport from `/sports`; `has_outrights` drives
  the futures branch, `group` keys the prop-market map. No hardcoded sport keys.
- **Markets are candidates, validated lazily** on selection: `200`+empty → empty
  state (not an error); `INVALID_MARKET_COMBO` prevented up front via `has_outrights`.
- **Searchable comboboxes** for the sport / event / market steps — fuzzy, client-side
  filtering over already-loaded lists; region stays a plain select.
- **Alternate markets excluded** — protects the identity key; the prop map is "all
  keys for the `group` minus `alternate_*` / `*_alternate`".
- **Region defaults to `us`, stays variable**; one region per check to start; extra
  regions multiply credit cost.
- **Stay out of live betting** — `closed` at `commenceTime`, Fetch disabled, value
  frozen at last pre-game state.
- **Deltas:** `point` linear; `price` via implied probability, never a raw American
  subtraction; literal `before → after` always shown.
- **One Fetch button per `(event, market, region)` section** = one 1-credit call
  refreshing every check in it.
- **Half-day bucket** for the delta baseline (odds move intraday, like weather).
- **Naming:** `TrackedSportsbook` / `SportsbookCheck`, matching `TrackedStock` /
  `StockCheck`.

## Implementation notes / deviations

- **`TrackedSportsbook` has no `fetchParams` object** — the flat coordinate fields
  (`sportKey`, `eventId`, `region`, `marketKey`) already are the refetch template;
  only `oddsFormat` was added.
- **Outright/futures sports**: The Odds API's `/events` endpoint *does* return one
  event (with an id) for `has_outrights` sports, so the drill-down auto-selects it
  and skips the event picker (rather than truly having no event). `getEventOdds`
  also falls back to the aggregate `/v4/sports/{key}/odds` endpoint when handed an
  empty `eventId`. Verified live: `americanfootball_nfl_super_bowl_winner` works;
  no `*_mvp` sport key is currently offered (the MVP use-case waits on the book
  posting it).
- **`bookmaker.last_update` is absent on the event-odds response** (unlike the bulk
  endpoint); `SportsbookCheck.lastUpdate` falls back to `market.last_update`, then
  `checkedAt`.
- **Point display**: negative lines keep their sign (`-2.5`); positive lines show
  bare (`3.5`, `45.5`). A `+` on positive spreads is a possible refinement.
- **`x-requests-remaining`** (the shared key's account-wide balance) is still
  captured into the `oddsRequestsRemaining` setting on every fetch, but it is not
  user-facing — the per-browser trial counter below is the number shown.

## Trial credits & bring-your-own-key

The deployed app calls The Odds API with one shared env key (`ODDS_API_KEY`). To
keep that key's 500/month from being drained by anonymous traffic, each browser
gets a small **trial allowance**; past it, the user supplies their own key.

- **`lib/sportsbookCredits.ts`** owns this. Two `Setting` rows:
  - `oddsApiKey` — the user's own key (string; empty / absent ⇒ on the trial key).
  - `sportsbookCredits` — `{ month: "YYYY-MM", used: number }`. Read as `0` when the
    stored month isn't the current one (calendar-month reset) or the row is gone
    (browser data cleared). No cron, no server state.
- **`TRIAL_CREDIT_LIMIT = 7`.** `getOddsAccess()` returns `{ userKey?, trialUsed,
  trialLimit, trialRemaining, blocked }`; `blocked` is `!userKey && trialRemaining
  <= 0`.
- **`chargedEventOdds(...)`** is the only path to the 1-credit endpoint. It refuses
  up front when `blocked`; otherwise calls `getEventOdds(..., access.userKey)` and,
  on a billable (`res.ok`) response **against the trial key only**, calls
  `recordTrialCreditSpent(1)`. Empty/error responses are free and not counted (The
  Odds API doesn't bill them either).
- **Key routing:** all three server actions take an optional `apiKeyOverride` last
  arg; `callOdds` uses `keyOverride?.trim() || process.env.ODDS_API_KEY`. The drill-
  down (`AddSportsbookForm`) loads the user key once and threads it to
  `listSports` / `listEvents`; `chargedEventOdds` resolves it itself.
- **Surfacing:** `useSportsbookAccess()` (`useLiveQuery(getOddsAccess)` — the two
  `Setting` reads are done via `Promise.all` so Dexie tracks them and the UI
  updates live). Sportsbook page blurb shows `trialUsed / trialLimit` (or "Using
  your own Odds API key."); the add-form's "Load outcomes" button disables when
  `blocked`; Settings → **Sportsbook** section shows the count, takes the key, and
  links to <https://the-odds-api.com/#get-access> (free tier).

## Open Questions

- Confirm a `200` empty-market response is not charged against the 500-credit quota
  (docs state this only for no-events responses).
- Player-award futures (MVP, DPOY) surface via `has_outrights` sports in `/sports`
  rather than hardcoding — verify such keys actually appear in-season and are stable
  enough to pin against.
- Multi-region per check (Nx credits) vs. strictly one region — starting with one.
- Decimal vs American as the default odds format, and whether it's a per-check
  override or a global setting.
- Surfacing `x-requests-remaining` / a monthly-credit gauge in the UI.
- Bucket granularity: half-day vs. "most recent check ≥ N hours old" — confirm
  against mockups, same open question as weather.
- Detail-page graph: is implied-probability-over-time legible enough as the primary
  series, or should raw American odds be shown with a non-linear axis?
