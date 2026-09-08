// Alpaca provider — pure fetch+parse, takes explicit credentials. Called by the
// /api/stocks route handler (SW-reachable) and the lookupSymbol server action.

import type { Result, StockQuote, SymbolInfo } from "@/lib/types";

const DATA_BASE = "https://data.alpaca.markets";
const TRADING_BASES = [
  "https://api.alpaca.markets",
  "https://paper-api.alpaca.markets",
];

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

/** Bulk snapshot fetch. Price is latestTrade.p, falling back to the latest bar. */
export async function fetchQuotes(
  symbols: string[],
  c: AlpacaCreds,
): Promise<Result<{ quotes: StockQuote[] }>> {
  const uniq = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (uniq.length === 0) return { ok: true, quotes: [] };

  const url = `${DATA_BASE}/v2/stocks/snapshots?symbols=${encodeURIComponent(
    uniq.join(","),
  )}`;
  try {
    const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        error: `Alpaca responded ${res.status} ${res.statusText}`,
      };
    }
    const json = (await res.json()) as Record<string, AlpacaSnapshot>;
    const quotes: StockQuote[] = [];
    for (const sym of uniq) {
      const snap = json[sym];
      const price =
        snap?.latestTrade?.p ??
        snap?.dailyBar?.c ??
        snap?.prevDailyBar?.c ??
        snap?.minuteBar?.c;
      if (typeof price === "number" && Number.isFinite(price)) {
        quotes.push({ symbol: sym, price });
      }
    }
    return { ok: true, quotes };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting Alpaca",
    };
  }
}

/** Validate a ticker and get its company name. */
export async function lookupAsset(
  symbol: string,
  c: AlpacaCreds,
): Promise<Result<{ info: SymbolInfo }>> {
  const s = symbol.trim().toUpperCase();
  if (!/^[A-Z.\-]{1,10}$/.test(s)) {
    return { ok: false, error: "That doesn't look like a ticker symbol." };
  }
  let lastStatus = "";
  for (const base of TRADING_BASES) {
    try {
      const res = await fetch(`${base}/v2/assets/${s}`, {
        headers: authHeaders(c),
        cache: "no-store",
      });
      if (res.status === 404) {
        return { ok: false, error: `No US equity found for "${s}".` };
      }
      if (res.status === 401 || res.status === 403) {
        lastStatus = `${res.status} ${res.statusText}`;
        continue; // wrong host for this key type — try the next base
      }
      if (!res.ok) {
        return {
          ok: false,
          error: `Alpaca responded ${res.status} ${res.statusText}`,
        };
      }
      const asset = (await res.json()) as { symbol: string; name?: string };
      return { ok: true, info: { symbol: asset.symbol, name: asset.name ?? s } };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error ? e.message : "Network error contacting Alpaca",
      };
    }
  }
  return {
    ok: false,
    error: `Alpaca rejected the API keys (${lastStatus}). Check ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY.`,
  };
}
