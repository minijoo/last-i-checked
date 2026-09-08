// Stock quotes for the Fetch button and autocheck (incl. the service worker,
// which can't call a Server Action). Keeps ALPACA keys server-side.

import { fetchQuotes } from "@/lib/providers/stocks";

export const runtime = "nodejs";

const NO_KEYS =
  "Alpaca API keys not set. Add ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY to .env.local, then restart the dev server.";

export async function GET(request: Request): Promise<Response> {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) {
    return Response.json({ ok: false, error: NO_KEYS });
  }
  const symbols = (new URL(request.url).searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Response.json(await fetchQuotes(symbols, { key, secret }));
}
