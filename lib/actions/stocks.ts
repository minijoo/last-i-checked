"use server";

// The "add stock" flow: fetch the price straight away — a price coming back is
// what makes a ticker valid, and it becomes the stock's first check. Bulk
// quotes live in the /api/stocks route handler; both go through
// lib/stockQuotes.ts.

import { usCandidates } from "@/lib/providers/stocks";
import { quotesFor } from "@/lib/stockQuotes";
import type { Result, StockMarket, StockQuote } from "@/lib/types";

export async function fetchNewStock(
  symbol: string,
  market: StockMarket,
): Promise<Result<{ quote: StockQuote }>> {
  const s = symbol.trim().toUpperCase();
  if (market === "kr") {
    if (!/^[0-9][0-9A-Z]{5}$/.test(s)) {
      return { ok: false, error: "Korean tickers are 6-character codes, e.g. 005930." };
    }
    const res = await quotesFor("kr", [s]);
    if (!res.ok) return res;
    const quote = res.quotes[0];
    return quote
      ? { ok: true, quote }
      : { ok: false, error: `No Korean listing found for "${s}".` };
  }

  if (market === "jp") {
    // Accept Yahoo's "7203.T" form too; the bare code is what's stored.
    const code = s.replace(/\.T$/, "");
    if (!/^[0-9][0-9A-Z]{3}$/.test(code)) {
      return {
        ok: false,
        error: "Japanese tickers are 4-character Tokyo codes, e.g. 7203 or 285A.",
      };
    }
    const res = await quotesFor("jp", [code]);
    if (!res.ok) return res;
    const quote = res.quotes[0];
    return quote
      ? { ok: true, quote }
      : { ok: false, error: `No Tokyo listing found for "${code}".` };
  }

  if (!/^[A-Z.\-/]{1,12}$/.test(s)) {
    return { ok: false, error: "That doesn't look like a ticker symbol." };
  }
  const candidates = usCandidates(s);
  const res = await quotesFor("us", candidates);
  if (!res.ok) return res;
  const quote = candidates
    .map((c) => res.quotes.find((q) => q.symbol === c))
    .find(Boolean);
  return quote
    ? { ok: true, quote }
    : { ok: false, error: `No US price found for "${s}".` };
}
