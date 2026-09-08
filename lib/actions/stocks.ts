"use server";

// Interactive Alpaca lookup (the "add stock" flow). Bulk quotes moved to the
// /api/stocks route handler so the service worker can reach them too — the
// provider fetch/parse is shared in lib/providers/stocks.ts.

import { lookupAsset } from "@/lib/providers/stocks";
import type { Result, SymbolInfo } from "@/lib/types";

const NO_KEYS =
  "Alpaca API keys not set. Add ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY to .env.local, then restart the dev server.";

/** Validate a ticker and get its company name (used by the "add stock" flow). */
export async function lookupSymbol(
  symbol: string,
): Promise<Result<{ info: SymbolInfo }>> {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return { ok: false, error: NO_KEYS };
  return lookupAsset(symbol, { key, secret });
}
