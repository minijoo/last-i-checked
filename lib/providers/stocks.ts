// Alpaca provider (US market) — pure fetch+parse, takes explicit credentials.
// Called via lib/stockQuotes.ts by the /api/stocks route handler and the
// addStock server action.

import type { Result, StockQuote } from "@/lib/types";

const DATA_BASE = "https://data.alpaca.markets";

export interface AlpacaCreds {
  key: string;
  secret: string;
}

function authHeaders(c: AlpacaCreds) {
  return { "APCA-API-KEY-ID": c.key, "APCA-API-SECRET-KEY": c.secret };
}

interface AlpacaBar {
  c?: number;
}
interface AlpacaSnapshot {
  latestTrade?: { p?: number };
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
  minuteBar?: AlpacaBar;
}

function snapshotPrice(snap: AlpacaSnapshot | undefined): number | undefined {
  const price =
    snap?.latestTrade?.p ??
    snap?.dailyBar?.c ??
    snap?.prevDailyBar?.c ??
    snap?.minuteBar?.c;
  return typeof price === "number" && Number.isFinite(price) ? price : undefined;
}

/** Bulk snapshot fetch. Price is latestTrade.p, falling back to the latest bar.
 *  US equities only — crypto moved to CoinMarketCap (lib/providers/crypto.ts). */
export async function fetchQuotes(
  symbols: string[],
  c: AlpacaCreds,
): Promise<Result<{ quotes: StockQuote[] }>> {
  const syms = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (syms.length === 0) return { ok: true, quotes: [] };
  const url = `${DATA_BASE}/v2/stocks/snapshots?symbols=${encodeURIComponent(syms.join(","))}`;
  try {
    const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        error: `Alpaca responded ${res.status} ${res.statusText}`,
      };
    }
    const snaps = (await res.json()) as Record<string, AlpacaSnapshot>;
    const quotes: StockQuote[] = [];
    for (const sym of syms) {
      const price = snapshotPrice(snaps[sym]);
      if (price !== undefined) quotes.push({ symbol: sym, market: "us", price });
    }
    return { ok: true, quotes };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting Alpaca",
    };
  }
}
