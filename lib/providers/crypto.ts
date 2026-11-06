// CoinMarketCap — every crypto price, in USD. Two endpoints:
//   GET /v1/cryptocurrency/map?symbol=DRB           ticker → coins (free, 0 credits)
//   GET /v3/cryptocurrency/quotes/latest?id=1,41909 prices (1 credit per 250 coins)
// Both take the key in the X-CMC_PRO_API_KEY header.

import { parseCryptoKey } from "@/lib/cryptoKey";
import type { CoinMatch, Result, StockQuote } from "@/lib/types";

const BASE = "https://pro-api.coinmarketcap.com";

interface CmcStatus {
  error_code: number | string;
  error_message: string | null;
}

interface CmcMapRow {
  id: number;
  name: string;
  symbol: string;
  rank: number | null;
  is_active: number;
  platform: { name: string } | null;
}

interface CmcQuoteRow {
  id: number;
  name: string;
  symbol: string;
  quote: { symbol: string; price: number | null }[];
}

type CmcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: CmcStatus };

async function cmcGet<T>(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<CmcResult<T>> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, {
      headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as {
      data?: T;
      status?: CmcStatus;
    } | null;
    const status = json?.status ?? { error_code: res.status, error_message: res.statusText };
    if (!res.ok || Number(status.error_code) !== 0 || json?.data === undefined) {
      return {
        ok: false,
        status,
        error: `CoinMarketCap responded ${res.status}${
          status.error_message ? `: ${status.error_message}` : ""
        }`,
      };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return {
      ok: false,
      status: { error_code: -1, error_message: null },
      error: e instanceof Error ? e.message : "Network error contacting CoinMarketCap",
    };
  }
}

/** Active coins listed under `ticker`, best-ranked first (unranked last). An
 *  unknown ticker is an empty list, not an error — CMC answers it with a 400. */
export async function findCoins(
  ticker: string,
  key: string,
): Promise<Result<{ coins: CoinMatch[] }>> {
  const res = await cmcGet<CmcMapRow[]>(
    "/v1/cryptocurrency/map",
    { symbol: ticker },
    key,
  );
  if (!res.ok) {
    if (/invalid value for "symbol"/i.test(res.status.error_message ?? "")) {
      return { ok: true, coins: [] };
    }
    return { ok: false, error: res.error };
  }
  const coins = res.data
    .filter((c) => c.is_active === 1)
    .map((c) => ({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      chain: c.platform?.name ?? c.name,
      rank: c.rank ?? null,
    }))
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  return { ok: true, coins };
}

/**
 * Prices for tracked coin keys ("DRB-41909"), one quotes call for the lot.
 * Legacy "BTC/USD" keys from the Alpaca days resolve to their ticker's
 * top-ranked coin first. Each quote comes back under the key it was asked for.
 */
export async function fetchCryptoQuotes(
  keys: string[],
  key: string,
): Promise<Result<{ quotes: StockQuote[] }>> {
  const idFor = new Map<string, number>();
  for (const k of keys) {
    const { ticker, id } = parseCryptoKey(k);
    if (id !== null) {
      idFor.set(k, id);
      continue;
    }
    const found = await findCoins(ticker, key);
    if (!found.ok) return found;
    if (found.coins[0]) idFor.set(k, found.coins[0].id);
  }
  const ids = [...new Set(idFor.values())];
  if (ids.length === 0) return { ok: true, quotes: [] };

  const res = await cmcGet<CmcQuoteRow[]>(
    "/v3/cryptocurrency/quotes/latest",
    { id: ids.join(","), convert: "USD", skip_invalid: "true" },
    key,
  );
  if (!res.ok) return { ok: false, error: res.error };

  const byId = new Map(res.data.map((row) => [row.id, row]));
  const quotes: StockQuote[] = [];
  for (const [k, id] of idFor) {
    const row = byId.get(id);
    const price = row?.quote.find((q) => q.symbol === "USD")?.price;
    if (row && typeof price === "number" && Number.isFinite(price)) {
      quotes.push({ symbol: k, market: "crypto", price, name: row.name });
    }
  }
  return { ok: true, quotes };
}
