// Bulk exchange-rate lookup for the Fetch button. A route handler (not a Server
// Action) for the same reason as /api/stocks. Frankfurter needs no API key.

import { fetchRates } from "@/lib/providers/currency";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const pairs = (new URL(request.url).searchParams.get("pairs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Response.json(await fetchRates(pairs));
}
