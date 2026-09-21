// Frankfurter provider (ECB reference rates) — pure fetch+parse, public API with
// no key. Called by the /api/currency route handlers. See docs/currency.md.

import type { CurrencyInfo, CurrencyQuote, Result } from "@/lib/types";

const BASE = "https://api.frankfurter.dev/v1";

/** The supported currencies, for the add form's dropdowns. */
export async function fetchCurrencies(): Promise<
  Result<{ currencies: CurrencyInfo[] }>
> {
  try {
    const res = await fetch(`${BASE}/currencies`);
    if (!res.ok) {
      return {
        ok: false,
        error: `Frankfurter responded ${res.status} ${res.statusText}`,
      };
    }
    const json = (await res.json()) as Record<string, string>;
    const currencies = Object.entries(json)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { ok: true, currencies };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting Frankfurter",
    };
  }
}

interface LatestResponse {
  base: string;
  date: string; // "YYYY-MM-DD"
  rates: Record<string, number>;
}

/**
 * Latest rate for each "BASE/TARGET" pair. Frankfurter takes one base per
 * request (many symbols), so this makes one request per distinct base, in
 * parallel. A pair missing from a response is simply absent from `quotes`.
 */
export async function fetchRates(
  pairs: string[],
): Promise<Result<{ quotes: CurrencyQuote[] }>> {
  const byBase = new Map<string, Set<string>>();
  for (const p of pairs) {
    const [base, target] = p.trim().toUpperCase().split("/");
    if (!/^[A-Z]{3}$/.test(base ?? "") || !/^[A-Z]{3}$/.test(target ?? "")) continue;
    if (base === target) continue;
    const set = byBase.get(base) ?? new Set<string>();
    set.add(target);
    byBase.set(base, set);
  }
  if (byBase.size === 0) return { ok: true, quotes: [] };

  try {
    const groups = await Promise.all(
      [...byBase].map(async ([base, targets]) => {
        const url = `${BASE}/latest?base=${base}&symbols=${[...targets].join(",")}`;
        const res = await fetch(url, { cache: "no-store" });
        // 404/422 = unknown base or symbol. Drop just this group (the caller
        // reports "No rate returned") rather than failing every other pair.
        if (res.status === 404 || res.status === 422) return [];
        if (!res.ok) {
          throw new Error(`Frankfurter responded ${res.status} ${res.statusText}`);
        }
        const json = (await res.json()) as LatestResponse;
        const quotes: CurrencyQuote[] = [];
        for (const target of targets) {
          const rate = json.rates?.[target];
          if (typeof rate === "number" && Number.isFinite(rate)) {
            quotes.push({
              pair: `${base}/${target}`,
              base,
              target,
              rate,
              rateDate: json.date,
            });
          }
        }
        return quotes;
      }),
    );
    return { ok: true, quotes: groups.flat() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting Frankfurter",
    };
  }
}
