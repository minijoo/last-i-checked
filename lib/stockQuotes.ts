// Server-only: routes a market's symbols to its provider with credentials from
// the environment. Shared by the /api/stocks route and the addStock action.

import { fetchJpQuotes } from "@/lib/providers/jpStocks";
import { fetchKrQuotes } from "@/lib/providers/krStocks";
import { fetchQuotes } from "@/lib/providers/stocks";
import type { Result, StockMarket, StockQuote } from "@/lib/types";

const NO_ALPACA_KEYS =
  "Alpaca API keys not set. Add ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY to .env.local, then restart the dev server.";
const NO_KR_KEY =
  "Korean market key not set. Add KR_API_KEY (a data.go.kr service key) to .env.local, then restart the dev server.";

export async function quotesFor(
  market: StockMarket,
  symbols: string[],
): Promise<Result<{ quotes: StockQuote[] }>> {
  if (symbols.length === 0) return { ok: true, quotes: [] };
  if (market === "kr") {
    const key = process.env.KR_API_KEY;
    if (!key) return { ok: false, error: NO_KR_KEY };
    return fetchKrQuotes(symbols, key);
  }
  if (market === "jp") return fetchJpQuotes(symbols);
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return { ok: false, error: NO_ALPACA_KEYS };
  return fetchQuotes(symbols, { key, secret });
}
