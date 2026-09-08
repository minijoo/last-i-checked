// Per-browser Odds API credit accounting. The app ships a small number of free
// "trial" credits against the shared env key; past that a user brings their own
// key. Everything lives in the Setting store, so it resets when the browser DB
// is cleared or a new calendar month starts. See docs/sportsbook.md.

import { store } from "./store";
import type { OddsApiEventOdds, OddsResult } from "./types";

export const TRIAL_CREDIT_LIMIT = 7;

const KEY_API_KEY = "oddsApiKey";
const KEY_CREDITS = "sportsbookCredits";

interface CreditRecord {
  month: string; // "YYYY-MM"
  used: number;
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The user's own Odds API key, or undefined when they're on the trial key. */
export async function getUserOddsKey(): Promise<string | undefined> {
  const v = await store.getSetting<string>(KEY_API_KEY);
  const trimmed = (v ?? "").trim();
  return trimmed || undefined;
}

export async function setUserOddsKey(key: string): Promise<void> {
  await store.setSetting(KEY_API_KEY, key.trim());
}

/** Trial credits spent this calendar month. Reads as 0 after a month rollover
 *  or a browser-DB clear (the record is simply gone / stale). */
export async function getTrialCreditsUsed(month = currentMonthKey()): Promise<number> {
  const rec = await store.getSetting<CreditRecord>(KEY_CREDITS);
  return rec && rec.month === month ? rec.used : 0;
}

export async function recordTrialCreditSpent(
  n = 1,
  month = currentMonthKey(),
): Promise<void> {
  const rec = await store.getSetting<CreditRecord>(KEY_CREDITS);
  const used = rec && rec.month === month ? rec.used : 0;
  await store.setSetting(KEY_CREDITS, { month, used: used + n });
}

export interface OddsAccess {
  userKey?: string; // set => their own key; trial limit does not apply
  trialUsed: number;
  trialLimit: number;
  trialRemaining: number;
  blocked: boolean; // true => a billable call must be refused
}

export async function getOddsAccess(
  month = currentMonthKey(),
): Promise<OddsAccess> {
  // Both reads up front via Promise.all so Dexie's liveQuery observability
  // reliably tracks them (used by useSportsbookAccess).
  const [rawKey, rec] = await Promise.all([
    store.getSetting<string>(KEY_API_KEY),
    store.getSetting<CreditRecord>(KEY_CREDITS),
  ]);
  const userKey = (rawKey ?? "").trim() || undefined;
  const trialUsed = rec && rec.month === month ? rec.used : 0;
  const trialRemaining = Math.max(0, TRIAL_CREDIT_LIMIT - trialUsed);
  return {
    userKey,
    trialUsed,
    trialLimit: TRIAL_CREDIT_LIMIT,
    trialRemaining,
    blocked: !userKey && trialRemaining <= 0,
  };
}

/**
 * The only path that should ever hit the 1-credit event-odds endpoint. Refuses
 * up front when trial credits are exhausted and no user key is set; otherwise
 * calls through with the right key and, on a billable (200-with-data) response
 * against the trial key, records one credit spent.
 */
export async function chargedEventOdds(
  sportKey: string,
  eventId: string,
  region: string,
  marketKey: string,
): Promise<OddsResult<{ odds: OddsApiEventOdds; remaining: string | null }>> {
  const access = await getOddsAccess();
  if (access.blocked) {
    return {
      ok: false,
      kind: "credits",
      error: `Trial limit reached (${access.trialUsed}/${access.trialLimit} credits this month). Add your own Odds API key in Settings to keep going.`,
    };
  }
  // Route handler (not a Server Action) so the service worker can call it too.
  const usp = new URLSearchParams({
    sportKey,
    eventId,
    region,
    markets: marketKey,
  });
  if (access.userKey) usp.set("key", access.userKey);
  let res: OddsResult<{ odds: OddsApiEventOdds; remaining: string | null }>;
  try {
    res = await (await fetch(`/api/sportsbook?${usp.toString()}`)).json();
  } catch (e) {
    res = {
      ok: false,
      kind: "other",
      error:
        e instanceof Error ? e.message : "Network error contacting The Odds API",
    };
  }
  // Empty (200, no data) and error responses are not billed by The Odds API.
  if (res.ok && !access.userKey) await recordTrialCreditSpent(1);
  return res;
}
