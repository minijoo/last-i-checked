// Bulk stock quotes for the Fetch button. A route handler (not a Server Action)
// so concurrent fetches don't serialize behind Next's action dispatcher; keeps
// provider keys server-side.
//
// GET /api/stocks?us=AAPL,BTC/USD&kr=005930 — one param per market. Markets
// fail independently: a failure lands in `errors[market]` and the other
// markets' quotes still come back.

import { MARKET_LABEL } from "@/lib/format";
import { quotesFor } from "@/lib/stockQuotes";
import type { StockMarket, StockQuote } from "@/lib/types";

export const runtime = "nodejs";

const MARKETS = Object.keys(MARKET_LABEL) as StockMarket[];

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const tracked = MARKETS.filter((m) => params.has(m));
  const results = await Promise.all(
    tracked.map((m) =>
      quotesFor(
        m,
        (params.get(m) ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ),
  );
  const quotes: StockQuote[] = [];
  const errors: Partial<Record<StockMarket, string>> = {};
  results.forEach((r, i) => {
    if (r.ok) quotes.push(...r.quotes);
    else errors[tracked[i]] = r.error;
  });
  return Response.json({ quotes, errors });
}
