"use server";

// The "add stock" flow: fetch the price straight away — a price coming back is
// what makes a ticker valid, and it becomes the stock's first check. Bulk
// quotes live in the /api/stocks route handler; both go through
// lib/stockQuotes.ts.

import { parseCryptoKey } from "@/lib/cryptoKey";
import { findCoins } from "@/lib/providers/crypto";
import { NO_CMC_KEY, quotesFor } from "@/lib/stockQuotes";
import type { CoinMatch, Result, StockMarket, StockQuote } from "@/lib/types";

/** Crypto step 1: the coins CoinMarketCap lists under a ticker ("DRB"). One
 *  match adds straight away; several open the pick-a-coin list. A trailing
 *  "USD" / "/USD" is forgiven ("BTCUSD" was the old way to type crypto) when
 *  the ticker as typed finds nothing. */
export async function findCoinsForTicker(
  ticker: string,
): Promise<Result<{ coins: CoinMatch[] }>> {
  const t = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9$.\-/]{1,20}$/.test(t)) {
    return { ok: false, error: "That doesn't look like a coin ticker." };
  }
  const key = process.env.CMC_API_KEY;
  if (!key) return { ok: false, error: NO_CMC_KEY };
  const res = await findCoins(t, key);
  if (!res.ok || res.coins.length > 0) return res;
  const bare = t.replace(/\/?USD$/, "");
  if (bare && bare !== t) return findCoins(bare, key);
  return res;
}

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

  if (market === "crypto") {
    // Step 2: `symbol` is the key of the coin picked in step 1 ("DRB-41909").
    if (parseCryptoKey(s).id === null) {
      return { ok: false, error: "Pick a coin first." };
    }
    const res = await quotesFor("crypto", [s]);
    if (!res.ok) return res;
    const quote = res.quotes[0];
    return quote
      ? { ok: true, quote }
      : { ok: false, error: `CoinMarketCap returned no price for ${parseCryptoKey(s).ticker}.` };
  }

  if (!/^[A-Z.\-]{1,12}$/.test(s)) {
    return { ok: false, error: "That doesn't look like a ticker symbol." };
  }
  const res = await quotesFor("us", [s]);
  if (!res.ok) return res;
  const quote = res.quotes[0];
  return quote
    ? { ok: true, quote }
    : { ok: false, error: `No US price found for "${s}". Crypto? Pick the Crypto market.` };
}
