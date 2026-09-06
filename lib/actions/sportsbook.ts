"use server";

// The Odds API proxy. Keeps ODDS_API_KEY server-side. Drill-down uses the free
// (0-credit) /sports and /events endpoints; getEventOdds is the 1-credit call
// used both to populate the outcome picker and to refresh tracked checks.
// See docs/sportsbook.md.

import type {
  OddsApiEvent,
  OddsApiEventOdds,
  OddsApiSport,
  OddsErrorKind,
  OddsResult,
} from "@/lib/types";

const BASE = "https://api.the-odds-api.com/v4";

const NO_KEY =
  "Odds API key not set. Add ODDS_API_KEY to .env.local, then restart the dev server.";

function apiKey(): string | null {
  return process.env.ODDS_API_KEY || null;
}

type RawCall =
  | { ok: true; data: unknown; remaining: string | null }
  | { ok: false; status: number; errorCode: string | null; message: string };

async function callOdds(
  path: string,
  params: Record<string, string> = {},
  keyOverride?: string,
): Promise<RawCall> {
  // A user-supplied key (from Settings) wins; otherwise the shared env key.
  const key = keyOverride?.trim() || apiKey();
  if (!key) {
    return { ok: false, status: 0, errorCode: "MISSING_KEY", message: NO_KEY };
  }
  const usp = new URLSearchParams({ apiKey: key, ...params });
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${usp.toString()}`, { cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      errorCode: null,
      message:
        e instanceof Error ? e.message : "Network error contacting The Odds API",
    };
  }
  const remaining = res.headers.get("x-requests-remaining");
  if (res.ok) return { ok: true, data: await res.json(), remaining };

  let errorCode: string | null = null;
  let message = `The Odds API responded ${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error_code?: string; message?: string };
    errorCode = body.error_code ?? null;
    if (body.message) message = body.message;
  } catch {
    /* non-JSON error body */
  }
  return { ok: false, status: res.status, errorCode, message };
}

function classify(call: Extract<RawCall, { ok: false }>): {
  kind: OddsErrorKind;
  error: string;
} {
  const code = call.errorCode ?? "";
  if (["MISSING_KEY", "INVALID_KEY", "DEACTIVATED_KEY"].includes(code)) {
    return {
      kind: "key",
      error:
        code === "MISSING_KEY"
          ? NO_KEY
          : "The Odds API rejected the key. Check ODDS_API_KEY in .env.local.",
    };
  }
  if (code === "OUT_OF_USAGE_CREDITS") {
    return {
      kind: "credits",
      error: "Monthly Odds API credit limit reached. Try again next month.",
    };
  }
  if (code === "EXCEEDED_FREQ_LIMIT" || call.status === 429) {
    return { kind: "rate", error: "Hit the Odds API rate limit — try again shortly." };
  }
  if (["EVENT_NOT_FOUND", "INVALID_EVENT_ID"].includes(code) || call.status === 404) {
    return { kind: "event_gone", error: "This event is no longer available." };
  }
  if (code === "INVALID_MARKET_COMBO") {
    return { kind: "invalid_combo", error: call.message };
  }
  if (["INVALID_MARKET", "UNKNOWN_MARKET"].includes(code)) {
    return { kind: "invalid_market", error: call.message };
  }
  return { kind: "other", error: call.message };
}

/** GET /v4/sports — every in-season sport (0 credits). */
export async function listSports(
  apiKeyOverride?: string,
): Promise<OddsResult<{ sports: OddsApiSport[] }>> {
  const call = await callOdds("/sports", {}, apiKeyOverride);
  if (!call.ok) return { ok: false, ...classify(call) };
  const sports = (call.data as OddsApiSport[])
    .filter((s) => s.active !== false)
    .sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title));
  return { ok: true, sports };
}

/** GET /v4/sports/{key}/events — upcoming events for a sport (0 credits). */
export async function listEvents(
  sportKey: string,
  apiKeyOverride?: string,
): Promise<OddsResult<{ events: OddsApiEvent[] }>> {
  const call = await callOdds(
    `/sports/${encodeURIComponent(sportKey)}/events`,
    { dateFormat: "iso" },
    apiKeyOverride,
  );
  if (!call.ok) return { ok: false, ...classify(call) };
  const events = (call.data as OddsApiEvent[] | null) ?? [];
  events.sort((a, b) => a.commence_time.localeCompare(b.commence_time));
  return { ok: true, events };
}

/** Odds for one market in one region (1 credit).
 *  - With an `eventId`: GET /v4/sports/{key}/events/{id}/odds.
 *  - Without one (futures / outright sports have no per-event id): GET
 *    /v4/sports/{key}/odds, taking the single competition it returns.
 *  A 200 with no book offering the market is reported as kind "empty". */
export async function getEventOdds(
  sportKey: string,
  eventId: string,
  region: string,
  marketKey: string,
  apiKeyOverride?: string,
): Promise<OddsResult<{ odds: OddsApiEventOdds; remaining: string | null }>> {
  const params = {
    regions: region,
    markets: marketKey,
    oddsFormat: "american",
    dateFormat: "iso",
  };
  const path = eventId
    ? `/sports/${encodeURIComponent(sportKey)}/events/${encodeURIComponent(
        eventId,
      )}/odds`
    : `/sports/${encodeURIComponent(sportKey)}/odds`;

  const call = await callOdds(path, params, apiKeyOverride);
  if (!call.ok) return { ok: false, ...classify(call) };

  // The aggregate endpoint returns an array; the per-event one, a single object.
  const raw = call.data as OddsApiEventOdds | OddsApiEventOdds[];
  const odds = Array.isArray(raw) ? raw[0] : raw;
  if (!odds) {
    return { ok: false, kind: "empty", error: "No odds returned for this selection." };
  }

  const hasOutcomes = (odds.bookmakers ?? []).some((b) =>
    (b.markets ?? []).some(
      (m) => m.key === marketKey && (m.outcomes ?? []).length > 0,
    ),
  );
  if (!hasOutcomes) {
    return {
      ok: false,
      kind: "empty",
      error: "No book has posted this market for this event yet.",
    };
  }
  return { ok: true, odds, remaining: call.remaining };
}
