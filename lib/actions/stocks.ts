"use server";

// Alpaca proxy. Keeps API keys server-side. See docs/plan.md "External Data-Sources".

import type { Result, StockQuote, SymbolInfo } from "@/lib/types";

const DATA_BASE = "https://data.alpaca.markets";
// Live keys authenticate here; paper keys (PK… prefix) need the paper host. We
// try live first and fall back, so either key type works for the name lookup.
const TRADING_BASES = [
  "https://api.alpaca.markets",
  "https://paper-api.alpaca.markets",
];

function creds(): { key: string; secret: string } | null {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  return key && secret ? { key, secret } : null;
}

function authHeaders(c: { key: string; secret: string }) {
  return { "APCA-API-KEY-ID": c.key, "APCA-API-SECRET-KEY": c.secret };
}

const NO_KEYS =
  "Alpaca API keys not set. Add ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY to .env.local, then restart the dev server.";

/** Bulk snapshot fetch. Price is latestTrade.p, falling back to the latest bar close. */
export async function fetchStockQuotes(
  symbols: string[],
): Promise<Result<{ quotes: StockQuote[] }>> {
  const c = creds();
  if (!c) return { ok: false, error: NO_KEYS };

  const uniq = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (uniq.length === 0) return { ok: true, quotes: [] };

  const url = `${DATA_BASE}/v2/stocks/snapshots?symbols=${encodeURIComponent(
    uniq.join(","),
  )}`;
  try {
    const res = await fetch(url, {
      headers: authHeaders(c),
      cache: "no-store",
    });
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

/** Validate a ticker and get its company name (used by the "add stock" flow). */
export async function lookupSymbol(
  symbol: string,
): Promise<Result<{ info: SymbolInfo }>> {
  const c = creds();
  if (!c) return { ok: false, error: NO_KEYS };

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
        error: e instanceof Error ? e.message : "Network error contacting Alpaca",
      };
    }
  }
  return {
    ok: false,
    error: `Alpaca rejected the API keys (${lastStatus}). Check ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY.`,
  };
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
