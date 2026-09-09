# Autocheck — Design

> **Status: Phases A + B implemented (2026-09-08).**
>
> - **A (check-on-open):** `lib/autocheck.ts` (`dueRuns`, `mergeAutocheck`,
>   `changesFor*`) + tests; `lib/autocheckTick.ts` (shared tick core: fetch +
>   diff + cross-tab Web Lock); `components/AutocheckRunner.tsx` in
>   `app/layout.tsx`; Settings → "Schedule Your Checks"; per-tab badge in
>   `PageSwitcher`; `run*Fetch` take `{ checkedAt? }` and write
>   `autocheckLastFetch`. `Setting` rows: `autocheck`, `autocheckLastFetch`,
>   `autocheckUnseen`.
> - **B (background):** `app/manifest.ts` + `public/logos/icon-*.png`
>   (installable); provider fetch/parse in `lib/providers/{stocks,weather,oddsapi}.ts`
>   behind route handlers `app/api/{stocks,weather,sportsbook}/route.ts` (a SW
>   can't call a Server Action); `lib/fetchers.ts` + `chargedEventOdds` call the
>   route handlers; `sw/index.ts` → `public/sw.js` via `scripts/build-sw.mjs`
>   (esbuild, run by `predev`/`prebuild`, gitignored); `lib/sw.ts` +
>   `components/ServiceWorker.tsx` register it; `periodicSync` tag
>   registered/unregistered on Settings save; DevPanel "Run background tick"
>   exercises the SW's `message` handler (real `periodicsync` needs an installed
>   PWA and can't be tested locally).
> - **C (Web Push):** not implemented — needs the v2 server.

Let the app run each category's fetch on a user-set time of day instead of only on
a manual button press, and notify the user **when — and only when — a tracked value
changed**. Goal: higher return-usage (every visit is already fresh; there's a reason
to come back) and better UX (no "did it change?" busywork).

## The constraint: browsers have no reliable scheduled background execution

| Mechanism | Fires at a set time? | Runs when app is closed? | Support | Verdict |
|---|---|---|---|---|
| `setTimeout` in a Service Worker | no — SW is killed ~30s after idle | no | all | useless here |
| **Periodic Background Sync** (`periodicSync`) | **no** — browser/OS pick the moment; `minInterval` is only a floor; ~once per 12–24h in practice | yes, if PWA **installed** | Chromium / Android only | best-effort enhancement |
| **Web Push** (a server sends "it's time") | **yes**, exact | yes | all incl. Safari 16.4+ (installed PWA) | needs a server that knows the schedule + tracked items → **v2 cloud/accounts** |
| **Check on app open / focus** (no SW) | n/a — runs when a tab opens | no | all | reliable, simple, cross-browser |

There is no client-only cron. The app is local-first with no server-side user data
in v1, so **Web Push is out of scope**. The plan is **check-on-open as the baseline,
Periodic Background Sync layered on where available**.

## Phases

- **Phase A — Check on open (no Service Worker).** A `<AutocheckRunner/>` mounted in
  `app/layout.tsx` ticks on three triggers — initial mount, `visibilitychange` →
  `visible` (a long-lived background tab), and a `setInterval` every 5 min **while
  the tab is visible** (a focused tab left open through a scheduled time). All three
  funnel through one `navigator.locks`-guarded call to `dueRuns()` and run the due
  fetches through the existing `lib/fetchers.ts`. Notifications fire via
  `new Notification(...)` (a tab is alive by definition). Cross-browser, ~1 day of
  work, delivers most of the value.
- **Phase B — Periodic Background Sync (progressive enhancement).** Web manifest +
  installability; provider Server Actions → Route Handlers (a SW cannot call a
  Server Action); a bundled `sw.js` whose `periodicsync` handler reuses the same
  `dueRuns()` engine against IndexedDB. Feature-detected; Phase A is the fallback
  everywhere it's absent.
- **Phase C — Web Push (deferred).** Exact-time, works when the app is never opened.
  Requires the v2 server + accounts to hold the schedule and push subscriptions.

## Schedule data model (`Setting` rows)

```ts
"autocheck": {
  enabled: boolean,
  notify: boolean,                 // notifications on change (default true)
  slots: {
    stocks:     { day: "HH:MM" | null },                       // day ∈ 00:00–23:59
    custom:     { day: "HH:MM" | null },
    weather:    { am: "HH:MM" | null, pm: "HH:MM" | null },     // am ∈ 00:00–11:59, pm ∈ 12:00–23:59
    sportsbook: { am: "HH:MM" | null, pm: "HH:MM" | null },
  },
}
"autocheckLastFetch": { stocks?: number, weather?: number, custom?: number, sportsbook?: number }  // epoch ms
"autocheckUnseen":     { stocks?: number, weather?: number, custom?: number, sportsbook?: number }  // change count since the user last opened that page
```

- `HH:MM` is **local wall-clock**. `null` per slot = that slot is off; a category is
  effectively off when all its slots are null.
- **One time per bucket.** 1-bucket categories (stocks, custom) have one `day` slot,
  any time. 2-bucket categories (weather, sportsbook) have an `am` and a `pm` slot,
  each constrained to its half-day so a run lands in the matching bucket.
- `autocheckLastFetch[category]` is written by **every** successful fetch — the
  manual Fetch buttons included — so a manual fetch satisfies that day's slot and
  autocheck doesn't re-run (matters for the sportsbook credit budget).

## The due-run engine

A pure function in `lib/autocheck.ts`, shared by the Phase-A page runner and the
Phase-B `periodicsync` handler, unit-testable with no browser APIs.

```ts
export function dueRuns(
  now: Date,
  cfg: Autocheck,
  lastFetch: Partial<Record<Category, number>>,
): Array<{ category: Category; slot: Slot; stampAt: number }> {
  if (!cfg.enabled) return [];
  const runs = [];
  for (const category of CATEGORIES) {
    const slots = category === "weather" || category === "sportsbook"
      ? (["am", "pm"] as const) : (["day"] as const);
    for (const slot of slots) {
      const hhmm = cfg.slots[category][slot];
      if (!hhmm) continue;
      const scheduled = todayAtLocal(now, hhmm).getTime(); // today's date + HH:MM, local tz
      if (now.getTime() >= scheduled && (lastFetch[category] ?? 0) < scheduled) {
        runs.push({ category, slot, stampAt: scheduled });
      }
    }
  }
  return runs;
}
```

### Why `now >= scheduled && lastFetch < scheduled`

`scheduled` is a per-day, per-slot **"gate opens at"** timestamp.

- `now >= scheduled` — the slot's time has arrived or passed. `>=` (not `>`) so
  `09:00:00` exactly counts.
- `lastFetch < scheduled` — we haven't walked through the gate yet today. A completed
  run stamps `lastFetch = scheduled` (see below), which closes the gate for the day.

The pair is a once-per-window trigger that is **stateless per evaluation and
self-healing** — it doesn't matter *when* it's evaluated, it always returns the
slots that still owe a run today. Trace, slot at `09:00`:

| evaluated at | `now ≥ 9:00` | `lastFetch < 9:00` | result |
|---|---|---|---|
| 08:00 (app opens) | no | — | not due — waits |
| 09:05 (app opens) | yes | yes (yesterday) | **runs**, then `lastFetch = today 09:00` |
| 09:30 (reopen) | yes | no (`9:00 < 9:00` is false) | doesn't re-run |
| 15:00 (device was off all morning) | yes | yes (still yesterday) | **runs** — catches up the missed 09:00 |
| tomorrow 09:10 | yes (vs *tomorrow* 09:00) | yes (today's `9:00` < tomorrow's) | gate re-armed — **runs** |

Two slots stay independent because each compares against **its own** `scheduled`:
open at 15:00 with weather `am=09:00` / `pm=18:00` → AM is due, PM is not (`15:00 <
18:00`); the PM slot fires later on its own gate. One AM reading, one PM reading.

The naive alternative — `setTimeout` until 09:00 — breaks on tab-closed,
device-asleep, timezone-change, and app-opened-after-09:00. This comparison ignores
all of that.

**No backfill of past days.** `dueRuns` only ever evaluates *today's* slot instances
(`todayAtLocal(now, hhmm)`). A `23:00` slot missed while the app is closed and next
opened at `08:00` the following day is simply skipped — its window closed with the
day. We don't reach back to fetch a "current" value into a bucket for a day that's
already over.

## Check stamping

An autocheck run stamps the written check with **`checkedAt = stampAt` (the slot's
scheduled time today), not `Date.now()`**. The fetch still returns the *current*
value; only the timestamp written on the row is set to the slot time. Bucketing
(`lib/buckets.ts`) reads `checkedAt` to pick the bucket — `< 12:00` local → AM.

### Worked catch-up example

Weather, `am = 09:00`, `pm = 18:00`:

```
09:00  AM slot due — device asleep / app closed, nothing runs
15:00  app opens → catch-up run: fetches the 15:00 forecast
18:00  PM slot due — runs on time: fetches the 18:00 forecast
```

| catch-up stamped at | AM bucket | PM bucket | result |
|---|---|---|---|
| **`now` (15:00)** | *(empty)* | 15:00 value, then overwritten by 18:00 | one PM reading, **no AM reading** — the AM fetch is wasted (`toColumns` keeps the last check per bucket) |
| **`stampAt` (09:00)** | 15:00 value, filed under 09:00 | 18:00 value | **two readings, correct buckets** — the AM slot survives |

So a caught-up 09:00 check holds the value as it stood at 15:00 but is filed in the
AM bucket and shown as the ~09:00 reading (the column header shows `formatClock(at)`
= `9:00AM`).

**Cost:** forecasts and lines drift between 09:00 and 15:00, so the AM bucket isn't a
true 09:00 snapshot. Minor, because (1) buckets are already coarse — "where it stood
in the AM half"; (2) deltas care which *bucket* a reading is in, not the exact
minute — a misfiled bucket corrupts the delta chain, a late timestamp inside the
right bucket doesn't; (3) it only happens on **missed** runs — an on-time 09:05 run
stamps ≈09:00 anyway.

For the 1-bucket categories (stocks, custom) the rule is harmless and irrelevant: a
catch-up at 15:00 lands in "today" whether stamped 09:00 or 15:00.

**Implementation:** `run*Fetch` takes a `{ checkedAt?: number }` option threaded to
where it currently calls `nowForCheck()`.

## First-time setup (Save in Settings → "Schedule Your Checks")

On the **Save** click (a user gesture — required for the permission prompt):

1. **Request notification permission** if `notify` is on and `Notification.permission
   === "default"`. Denied → autocheck still runs; changes surface as an in-app badge.
2. **Register the Service Worker** (`navigator.serviceWorker.register('/sw.js')`) —
   idempotent, safe every load. *(Phase B.)*
3. **Try Periodic Background Sync** *(Phase B, Chromium)*:
   `permissions.query({ name: 'periodic-background-sync' })`; if `granted` **and the
   `'autocheck'` tag isn't already registered**,
   `registration.periodicSync.register('autocheck', { minInterval: 4 * 60 * 60 * 1000 })`
   — one fixed 4 h floor, one tag for all categories (the browser clamps it to its
   own ~12 h cap anyway; no point computing it from slot gaps). The permission can't
   be prompted; it's auto-granted on engagement / install. Not granted → fine, Phase
   A covers it.
4. **Write the schedule** + `enabled: true`.
5. **Stamp `autocheckLastFetch[cat] = now` for every category that has ≥1 slot.**
   This prevents slots whose time has **already passed today** from retro-firing the
   moment Save is clicked. Checks begin at the **next** scheduled occurrence. UI
   copy: *"Checks start at the next scheduled time."*

**Default slot times.** A never-configured schedule (`Setting["autocheck"]` unset)
starts with every slot pre-filled — stocks `15:30`, custom `18:00`, weather /
sportsbook `06:00` AM + `18:00` PM — but `enabled: false`, so the user reviews and
turns it on. `mergeAutocheck` applies these only when the stored value has no
`slots` key; once saved, explicit `null`s (slots the user turned off) are kept.
`DEFAULT_AUTOCHECK` in `lib/autocheck.ts`.

## Schedule changes

**One rule covers every case: a schedule edit never triggers a fetch.**

- **Time changed / slot added:** rewrite the `Setting` row; the engine reads the new
  value on its next tick. **Also stamp `autocheckLastFetch[cat] = now` for each
  edited category** — so moving stocks `09:00 → 08:00` at 10:00 doesn't fire an
  "08:00 already passed" run. The new time takes effect from its next occurrence.
- **Slot disabled** (time → `null`): rewrite; the engine skips `null`. No unregister
  (one shared `periodicSync` tag).
- **Master `enabled` → off:** `registration.periodicSync.unregister('autocheck')`.
  Keep the SW registered and keep the stored times so re-enabling restores them.
- **Notifications toggled on** with permission `default` → prompt; `denied` → show
  "blocked in browser settings" and fall back to the in-app badge.

## Notifications

- **Only on change.** After a run, diff each tracked item's just-written bucket value
  against the previous bucket — the delta logic already exists (`toColumns()[0].delta`,
  `toOddsColumns()[0].priceDelta / pointDelta`, `toCustomColumns`). First-ever check
  for an item → no previous → no notification.
- **One notification per *changed* category per run**, tagged
  (`tag: "autocheck-stocks"`, `renotify: true`) so a fresh one replaces the old — no
  stacking. A catch-up that fetches three categories but only changes stocks → one
  notification. Multiple changed at once is uncommon and each is individually
  actionable; a "collapse when ≥3 categories changed" refinement is deferred until
  it proves annoying. Body names the value: `"NVDA +3.10 → 178.42 · AAPL −0.80 →
  231.10"`; weather `"Wed 9/11 AM: high 84° (+2)"`; sportsbook `"Pats spread: line
  3.5 → 4.0"`. More than ~3 items in one category → `"NVDA, AAPL and 3 more
  changed."`
- **Click:** Phase B — SW `notificationclick` focuses a tab or
  `clients.openWindow('/stocks')`. Phase A — `notification.onclick` on the
  page-created `Notification`.
- **In-app badge, always.** `PageSwitcher` shows a per-tab change count
  (`autocheckUnseen[category]`), cleared when the user opens that page. It's the
  "come back" signal, visible from anywhere, and shown even when notifications are
  granted (in case one is missed or dismissed) — and it's the *only* signal when
  notifications are denied or unsupported. No per-page banner: the delta columns
  already show what changed once you're on the page, and notifications carry the
  detail.

## Periodic Background Sync — what it does and doesn't guarantee

The `"09:00"` in Settings is **never handed to the browser**. `periodicSync.register()`
takes only `minInterval` (ms) — a *floor* on frequency, not a schedule. `periodicsync`
is a coarse "you may do background work now" wake-up; the handler then runs
`dueRuns(now, …)` against the stored `09:00`.

- **Lower bound (controlled):** never before `09:00` — the `now >= scheduled` guard.
- **Upper bound (not controlled):** the check runs at the **first `periodicsync`
  wake-up at or after `09:00`** — 09:00, 10:40, 14:00, or tomorrow if the device was
  off. No double-run — the `lastFetch < scheduled` guard.
- The browser + OS choose the moment from network state (often wifi-only),
  battery / charging, site-engagement score, and OS background budgets. Chrome
  practice: roughly **once per ~12 h** for an engaged installed PWA.
- **Revocable and narrow:** engagement drops → Chrome silently stops firing it; the
  user can block it; absent entirely without an installed PWA, and on Safari /
  Firefox.

**Settings UI framing:** label the field **"preferred time (~9:00 AM)"**, not "at
9:00", and note that background checks are approximate while opening the app is exact
and fills any gap.

## Phase B — Service Worker specifics

- **Route Handlers, not Server Actions.** `lib/actions/*.ts` are Next Server Actions,
  invoked over a Next-specific RPC bound to the React client runtime — **a Service
  Worker cannot call one**. A Route Handler (`app/api/.../route.ts`) is a plain HTTP
  endpoint the SW can `fetch()`. Extract the provider `fetch`+parse logic into
  `lib/providers/*`, expose it via route handlers, keep the Server Actions (or the
  manual buttons) as thin wrappers over the same functions.
- **Bundled `sw.js`.** Next doesn't build service workers. Use Serwist / next-pwa or
  a small esbuild step, because the SW imports app code: `lib/autocheck.ts`, the
  Dexie layer (IndexedDB works in a worker), the diff logic. `localStorage` is
  absent in a SW — only `devtime` (dev-only) touches it, so it's a non-issue.
- **`periodicsync` handler** reuses the exact `dueRuns()` from Phase A:

  ```js
  self.addEventListener("periodicsync", (e) => {
    if (e.tag === "autocheck") e.waitUntil(runAutocheck());
    // read schedule + tracked items → dueRuns() → route-handler fetches → write → diff → showNotification
  });
  ```

## Edge cases

- **Multiple tabs** run the same tick → double fetch / double sportsbook-credit
  spend. Guard with `navigator.locks.request('autocheck', …)` (well supported) or a
  ~60 s IndexedDB lock.
- **Offline / device asleep at slot time** → fetch fails → `lastFetch` not updated →
  the slot stays due → self-heals on the next open / sync. Cap retries; surface a
  soft error.
- **Sportsbook vs the 7-credit trial — allow with a warning, don't gate.** It's
  self-capping: `chargedEventOdds` blocks at 7 credits/month per browser, so the
  shared key can't be drained regardless. The only cost is the "worked for 3 days
  then stopped" surprise, handled by:
  - the row shows *"≈2 credits/day · ~3 days on the 7/month trial"* (the slots are
    pre-filled like the others — the whole schedule still starts `enabled: false`);
  - a stronger *"add your own Odds API key (free, 500/month) so scheduled checks
    don't burn your trial"* nudge when no `oddsApiKey` is set;
  - a **one-shot** notification the first time an autocheck hits `blocked` (flagged
    so it doesn't nag every tick), then sportsbook autocheck goes quiet until credits
    reset or a key is added.
- **DST / timezone:** store wall-clock `HH:MM`; resolve against the device's current
  tz each tick; accept the once-a-year hour skew.
- **`closed` sportsbook sections, past-date weather pins** — the fetch layer already
  skips these.

## Milestones

1. `lib/autocheck.ts` — `dueRuns`, `todayAtLocal`, the slot map — plus tests. `Setting`
   shapes into `schema.md`. `run*Fetch` take `{ checkedAt? }` and write
   `autocheckLastFetch`.
2. Settings → **"Schedule Your Checks"** section: per-category time pickers (AM/PM
   constrained, pre-filled from `DEFAULT_AUTOCHECK`), master + notify toggles;
   sportsbook row shows the credit-cost line and the no-key nudge.
3. `<AutocheckRunner/>` in `layout.tsx`: mount + `visibilitychange` + 5 min interval
   while visible → `navigator.locks` → `dueRuns` → fetch → diff → notify +
   `autocheckUnseen` badge in `PageSwitcher`. **← usable after this.**
4. Web manifest + icons + `display: standalone` (installability).
5. `lib/providers/*` + provider route handlers; bundled `sw.js`; `periodicsync`
   handler reusing `dueRuns`; feature-detect and fall back to milestone 3.

## Decisions

- **Check stamped at the slot time** (`stampAt`), not `now`, so a caught-up run lands
  in the intended bucket instead of being overwritten by the on-time run of the next
  slot. Details + worked example in *Check stamping*.
- **Schedule edits never trigger a fetch.** Stamp `autocheckLastFetch[cat] = now` on
  first enable and on every edit; the new time takes effect from its next occurrence.
- **No backfill of past days** — `dueRuns` only evaluates today's slot instances.
- **Sportsbook autocheck: allow, don't gate.** Self-capped at 7 credits/month by
  `chargedEventOdds`. The settings row shows the credit cost and a "add your own key"
  nudge; one-shot notification on the first `blocked`.
- **`periodicSync` `minInterval` = fixed 4 h**, registered idempotently. The browser
  clamps to its own cap; deriving it from slot gaps buys nothing.
- **One notification per *changed* category per run**, tagged so fresh replaces
  stale. "Collapse when many categories change" deferred.
- **In-app signal = a per-tab count badge in `PageSwitcher`**, always shown (not only
  when notifications are denied), cleared on page open. No per-page banner.
- **Phase-A runner ticks on mount + `visibilitychange` → visible + a 5 min interval
  while visible**, all through one `navigator.locks`-guarded `dueRuns()` call.
- **Default slot times** for a never-configured schedule (still `enabled: false`):
  stocks `15:30`, custom `18:00`, weather / sportsbook `06:00` + `18:00`
  (`DEFAULT_AUTOCHECK`). Applied only when the stored value has no `slots` key; saved
  `null`s are preserved.

## Open questions

_None — see Decisions. New questions to record here as they come up._
