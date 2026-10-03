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

/**
 * Bulk snapshot fetch. Price is latestTrade.p, falling back to the latest bar.
 * Crypto pairs ("BTC/USD") live on a separate data endpoint that requires the
 * slash form; equities go to the stocks endpoint.
 */
export async function fetchQuotes(
  symbols: string[],
  c: AlpacaCreds,
): Promise<Result<{ quotes: StockQuote[] }>> {
  const uniq = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (uniq.length === 0) return { ok: true, quotes: [] };

  const crypto = uniq.filter((s) => s.includes("/"));
  const equities = uniq.filter((s) => !s.includes("/"));

  const fetchGroup = async (
    syms: string[],
    path: string,
    unwrap: (json: unknown) => Record<string, AlpacaSnapshot>,
  ): Promise<Result<{ quotes: StockQuote[] }>> => {
    if (syms.length === 0) return { ok: true, quotes: [] };
    const url = `${DATA_BASE}${path}?symbols=${encodeURIComponent(syms.join(","))}`;
    try {
      const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
      if (!res.ok) {
        return {
          ok: false,
          error: `Alpaca responded ${res.status} ${res.statusText}`,
        };
      }
      const snaps = unwrap(await res.json());
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
  };

  const [eq, cr] = await Promise.all([
    fetchGroup(equities, "/v2/stocks/snapshots", (j) => j as Record<string, AlpacaSnapshot>),
    fetchGroup(
      crypto,
      "/v1beta3/crypto/us/snapshots",
      (j) => (j as { snapshots?: Record<string, AlpacaSnapshot> }).snapshots ?? {},
    ),
  ]);
  if (!eq.ok) return eq;
  if (!cr.ok) return cr;
  return { ok: true, quotes: [...eq.quotes, ...cr.quotes] };
}

/**
 * Symbols to try for a ticker typed into the add form. Crypto is typed
 * "BTCUSD" (or "BTC/USD") but Alpaca only quotes the slash form, so a
 * crypto-looking ticker is tried both ways; an equity quote wins if both hit.
 */
export function usCandidates(symbol: string): string[] {
  const s = symbol.trim().toUpperCase();
  const pair = /^([A-Z]{2,6})(USD|USDT|USDC|BTC)$/.exec(s);
  return pair ? [s, `${pair[1]}/${pair[2]}`] : [s];
}
