"use client";

import { useState } from "react";
import { fetchNewStock, findCoinsForTicker } from "@/lib/actions/stocks";
import { cryptoKey, displaySymbol } from "@/lib/cryptoKey";
import { jitterValue, nowForCheck } from "@/lib/devtime";
import { MARKET_LABEL, formatStockPrice } from "@/lib/format";
import { store } from "@/lib/store";
import type { CoinMatch, StockMarket } from "@/lib/types";
import { Combobox, type ComboOption } from "./Combobox";
import { Modal } from "./Modal";
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
  // Several CoinMarketCap coins share the typed ticker: the user picks one.
  const [choices, setChoices] = useState<CoinMatch[] | null>(null);

  /** The price fetch doubles as validation: no price, no stock. */
  async function add(symbol: string, m: StockMarket) {
    const res = await fetchNewStock(symbol, m);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const { name, price } = res.quote;
    await store.addTrackedStock({ symbol: res.quote.symbol, market: m, name });
    await store.appendStockChecks([
      {
        checkedAt: nowForCheck(),
        symbol: res.quote.symbol,
        market: m,
        price: jitterValue(price),
      },
    ]);
    setOk(
      `Added ${displaySymbol(res.quote.symbol, m)}${name ? ` — ${name}` : ""} at ${formatStockPrice(price, m)}`,
    );
    setValue("");
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add symbol.");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = value.trim().toUpperCase();
    if (!s) return;
    void run(async () => {
      if (market !== "crypto") return add(s, market);
      const res = await findCoinsForTicker(s);
      if (!res.ok) return setError(res.error);
      const [only, ...rest] = res.coins;
      if (!only) return setError(`No coin found on CoinMarketCap for "${s}".`);
      if (rest.length === 0) return add(cryptoKey(only.symbol, only.id), "crypto");
      setChoices(res.coins);
    });
  }

  function pick(coin: CoinMatch) {
    setChoices(null);
    void run(() => add(cryptoKey(coin.symbol, coin.id), "crypto"));
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
        ) : market === "jp" ? (
          <>
            Tokyo Stock Exchange codes: e.g. 7203 (Toyota), 285A (Kioxia)
            <br />
            Prices are delayed during trading hours, in yen.
          </>
        ) : market === "crypto" ? (
          <>
            Coin tickers: e.g. BTC, ETH, DRB
            <br />
            Prices from CoinMarketCap, in USD.
          </>
        ) : (
          <>Stocks: e.g. AAPL, NVDA</>
        )}
      </p>
      {ok && <p className="text-xs text-up">{ok}</p>}
      {error && <p className="text-xs text-down">{error}</p>}

      <Modal
        open={choices !== null}
        onClose={() => setChoices(null)}
        title={`Which ${choices?.[0]?.symbol ?? "coin"}?`}
      >
        <ul className="py-1">
          {(choices ?? []).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => pick(c)}
                className="flex w-full items-baseline justify-between gap-4 px-4 py-2 text-left hover:bg-background"
              >
                <span className="text-sm font-medium">{c.name}</span>
                <span className="shrink-0 text-xs text-muted">{c.chain}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </form>
  );
}
