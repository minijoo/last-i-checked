"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AddSymbolForm } from "@/components/AddSymbolForm";
import { NumMatrix, type NumRow } from "@/components/CheckMatrix";
import { FetchBar } from "@/components/FetchBar";
import { MatrixFrame } from "@/components/MatrixFrame";
import { Card } from "@/components/ui";
import { toColumns } from "@/lib/buckets";
import { runStockFetch } from "@/lib/fetchers";
import { MARKET_TAG, formatStockPrice, stockDigits } from "@/lib/format";
import { useAllStockChecks, useDeltaMode, useTrackedStocks } from "@/lib/hooks";
import { store } from "@/lib/store";

export default function StocksPage() {
  const tracked = useTrackedStocks();
  const checks = useAllStockChecks();
  const asPercent = useDeltaMode("stocks") === "pct";
  const loading = tracked === undefined || checks === undefined;

  const rows = useMemo<NumRow[]>(() => {
    const bySymbol = new Map<string, { checkedAt: number; value: number }[]>();
    for (const c of checks ?? []) {
      const arr = bySymbol.get(c.symbol) ?? [];
      arr.push({ checkedAt: c.checkedAt, value: c.price });
      bySymbol.set(c.symbol, arr);
    }
    return (tracked ?? []).map((t) => ({
      id: t.symbol,
      label: (
        <span className="flex items-baseline gap-2">
          {t.market !== "us" && t.name ? (
            // KR codes are opaque, so the company name leads.
            <Link
              href={`/stocks/${t.symbol}`}
              className="flex flex-col leading-tight hover:underline"
            >
              <span className="text-lg font-semibold">{t.name}</span>
              <span className="text-xs text-muted">
                ({MARKET_TAG[t.market]} · {t.symbol})
              </span>
            </Link>
          ) : (
            <Link
              href={`/stocks/${t.symbol}`}
              className="font-mono font-semibold hover:underline"
            >
              {t.symbol}
            </Link>
          )}
          <button
            onClick={() => store.removeTrackedStock(t.symbol)}
            className="text-xs text-muted hover:text-down"
            title="Stop tracking (keeps history)"
          >
            ×
          </button>
        </span>
      ),
      columns: toColumns(bySymbol.get(t.symbol) ?? [], "stock"),
      format: (n: number) => formatStockPrice(n, t.market),
      digits: stockDigits(t.market),
    }));
  }, [tracked, checks]);

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
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No symbols tracked yet. Add a ticker above, then hit{" "}
            <span className="text-foreground">Fetch prices</span>.
          </p>
        </Card>
      ) : (
        <Card>
          <MatrixFrame page="stocks">
            <NumMatrix rows={rows} percent={asPercent} />
          </MatrixFrame>
          <p className="mt-3 text-xs text-muted">
            Columns are the days you fetched. A blank cell means no check that day
            (symbol added later, or untracked then re-tracked). Deltas compare
            each symbol against its own previous check; the{" "}
            <span className="text-foreground">%</span> toggle switches them
            between absolute and percent change.
          </p>
        </Card>
      )}
    </div>
  );
}
