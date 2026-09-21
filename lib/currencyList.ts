"use client";

// The supported-currency list, fetched once per page load and shared by the add
// form and the row tooltips. `null` while loading or if the lookup failed.

import { useEffect, useState } from "react";
import type { CurrencyInfo, Result } from "./types";

let cached: Promise<Result<{ currencies: CurrencyInfo[] }>> | null = null;

function load() {
  cached ??= fetch("/api/currency/currencies")
    .then((r) => r.json() as Promise<Result<{ currencies: CurrencyInfo[] }>>)
    .catch((e): Result<{ currencies: CurrencyInfo[] }> => ({
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
    }));
  return cached;
}

export function useCurrencyList(): {
  currencies: CurrencyInfo[] | null;
  error: string | null;
} {
  const [state, setState] = useState<{
    currencies: CurrencyInfo[] | null;
    error: string | null;
  }>({ currencies: null, error: null });

  useEffect(() => {
    let live = true;
    void load().then((r) => {
      if (!live) return;
      if (r.ok) setState({ currencies: r.currencies, error: null });
      else {
        cached = null; // retry on the next mount
        setState({ currencies: null, error: r.error });
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return state;
}
