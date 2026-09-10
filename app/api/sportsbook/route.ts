// Event odds (1 credit) for the Sportsbook Fetch button and the add-flow outcome
// picker. `key` (optional) is the user's own Odds API key from Settings;
// otherwise the shared env key is used.

import { getEventOdds } from "@/lib/providers/oddsapi";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const sportKey = sp.get("sportKey") ?? "";
  const eventId = sp.get("eventId") ?? "";
  const region = sp.get("region") ?? "us";
  const markets = sp.get("markets") ?? "";
  const userKey = sp.get("key") ?? undefined;

  if (!sportKey || !markets) {
    return Response.json({
      ok: false,
      kind: "other",
      error: "Missing sportKey or markets.",
    });
  }
  return Response.json(
    await getEventOdds(
      sportKey,
      eventId,
      region,
      markets,
      process.env.ODDS_API_KEY || null,
      userKey,
    ),
  );
}
