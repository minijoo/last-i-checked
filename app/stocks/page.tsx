"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AddSymbolForm } from "@/components/AddSymbolForm";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card } from "@/components/ui";
import { toColumns } from "@/lib/buckets";
import { useAllStockChecks, useTrackedStocks } from "@/lib/hooks";
import { runStockFetch } from "@/lib/fetchers";
import { formatPrice } from "@/lib/format";
import { store } from "@/lib/store";

const HOME_COLUMNS = 4;

export default function StocksPage() {
  const tracked = useTrackedStocks();
  const checks = useAllStockChecks();
  const loading = tracked === undefined || checks === undefined;

  const bySymbol = useMemo(() => {
    const m = new Map<string, { checkedAt: number; value: number }[]>();
    for (const c of checks ?? []) {
      const arr = m.get(c.symbol) ?? [];
      arr.push({ checkedAt: c.checkedAt, value: c.price });
      m.set(c.symbol, arr);
    }
    return m;
  }, [checks]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stocks</h1>
          <p className="mt-1 text-sm text-muted">
            How each price has moved since the last day you checked.
          </p>
        </div>
        <FetchBar onFetch={runStockFetch} label="Fetch prices" />
      </div>

      <AddSymbolForm />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : tracked.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No symbols tracked yet. Add a ticker above, then hit{" "}
            <span className="text-foreground">Fetch prices</span>.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {tracked.map((t) => {
            const cols = toColumns(
              bySymbol.get(t.symbol) ?? [],
              "stock",
              HOME_COLUMNS,
            );
            return (
              <li key={t.symbol}>
                <Card>
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/stocks/${t.symbol}`}
                      className="font-mono text-base font-semibold hover:underline"
                    >
                      {t.symbol}
                    </Link>
                    <button
                      onClick={() => store.removeTrackedStock(t.symbol)}
                      className="text-xs text-muted hover:text-down"
                      title="Stop tracking (keeps history)"
                    >
                      untrack
                    </button>
                  </div>
                  <DeltaColumns
                    columns={cols}
                    format={formatPrice}
                    emptyLabel="Not checked yet — hit Fetch prices."
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
