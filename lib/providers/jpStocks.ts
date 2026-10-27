// Japanese market provider — Yahoo Finance's chart endpoint, which needs no
// key. It's unofficial and undocumented, so it's kept to this one file to be
// swapped out (e.g. for J-Quants) if it changes. Pure fetch+parse.
//
// Codes are TSE securities codes ("7203", "285A"); Yahoo wants the ".T"
// (Tokyo) suffix. `regularMarketPrice` is the last trade — delayed during the
// session, the day's close after it. Prices are in JPY.

import type { Result, StockQuote } from "@/lib/types";

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";

interface ChartMeta {
  currency?: string;
  regularMarketPrice?: number;
  longName?: string;
  shortName?: string;
}

interface ChartResponse {
  chart?: {
    result?: { meta?: ChartMeta }[] | null;
    error?: { code?: string; description?: string } | null;
  };
}

async function fetchOne(
  code: string,
): Promise<Result<{ quote: StockQuote | null }>> {
  const url = `${ENDPOINT}/${encodeURIComponent(`${code}.T`)}?range=1d&interval=1d`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    // Unknown codes come back 404 "No data found" — not an outage.
    if (res.status === 404) return { ok: true, quote: null };
    if (!res.ok) {
      return { ok: false, error: `Yahoo Finance responded ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as ChartResponse;
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (!meta || typeof price !== "number" || !Number.isFinite(price)) {
      return { ok: true, quote: null };
    }
    return {
      ok: true,
      quote: { symbol: code, market: "jp", price, name: meta.longName ?? meta.shortName },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting Yahoo Finance",
    };
  }
}

/** One request per code (the chart endpoint takes a single symbol); codes with
 *  no data are simply absent from `quotes`, like the other providers. */
export async function fetchJpQuotes(
  codes: string[],
): Promise<Result<{ quotes: StockQuote[] }>> {
  const uniq = [
    ...new Set(codes.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  const results = await Promise.all(uniq.map(fetchOne));
  const quotes: StockQuote[] = [];
  for (const r of results) {
    if (!r.ok) return r;
    if (r.quote) quotes.push(r.quote);
  }
  return { ok: true, quotes };
}
