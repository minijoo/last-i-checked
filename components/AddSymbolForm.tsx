"use client";

import { useState } from "react";
import { fetchNewStock } from "@/lib/actions/stocks";
import { jitterValue, nowForCheck } from "@/lib/devtime";
import { MARKET_LABEL, formatStockPrice } from "@/lib/format";
import { store } from "@/lib/store";
import type { StockMarket } from "@/lib/types";
import { Combobox, type ComboOption } from "./Combobox";
import { Button, Input } from "./ui";

const MARKET_OPTIONS: ComboOption[] = (
  Object.entries(MARKET_LABEL) as [StockMarket, string][]
).map(([value, label]) => ({ value, label }));

export function AddSymbolForm() {
  const [market, setMarket] = useState<StockMarket>("us");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = value.trim().toUpperCase();
    if (!s) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      // The price fetch doubles as validation: no price, no stock.
      const res = await fetchNewStock(s, market);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { symbol, name, price } = res.quote;
      await store.addTrackedStock({ symbol, market, name });
      await store.appendStockChecks([
        { checkedAt: nowForCheck(), symbol, market, price: jitterValue(price) },
      ]);
      setOk(
        `Added ${symbol}${name ? ` — ${name}` : ""} at ${formatStockPrice(price, market)}`,
      );
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add symbol.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        <div className="w-40">
          <Combobox
            options={MARKET_OPTIONS}
            value={market}
            onChange={(m) => {
              setMarket(m as StockMarket);
              setError(null);
              setOk(null);
            }}
            placeholder="Market"
            floatingLabel
          />
        </div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a ticker"
          className="w-48"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "…" : "Add"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        {market === "kr" ? (
          <>
            KOSPI / KOSDAQ codes: e.g. 005930 (Samsung Electronics)
            <br />
            Prices are the latest daily close, in won.
          </>
        ) : (
          <>
            Stocks: e.g. AAPL, NVDA
            <br />
            Crypto: e.g. BTCUSD, ETHUSD
          </>
        )}
      </p>
      {ok && <p className="text-xs text-up">{ok}</p>}
      {error && <p className="text-xs text-down">{error}</p>}
    </form>
  );
}
