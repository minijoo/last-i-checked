"use server";

// Interactive Odds API calls for the add-flow drill-down (both 0-credit). The
// 1-credit getEventOdds moved to the /api/sportsbook route handler so the
// service worker can reach it; the shared fetch/parse lives in
// lib/providers/oddsapi.ts. See docs/sportsbook.md.

import {
  listEvents as providerListEvents,
  listSports as providerListSports,
} from "@/lib/providers/oddsapi";
import type { OddsApiEvent, OddsApiSport, OddsResult } from "@/lib/types";

function envKey(): string | null {
  return process.env.ODDS_API_KEY || null;
}

export async function listSports(
  apiKeyOverride?: string,
): Promise<OddsResult<{ sports: OddsApiSport[] }>> {
  return providerListSports(envKey(), apiKeyOverride);
}

export async function listEvents(
  sportKey: string,
  apiKeyOverride?: string,
): Promise<OddsResult<{ events: OddsApiEvent[] }>> {
  return providerListEvents(sportKey, envKey(), apiKeyOverride);
}
