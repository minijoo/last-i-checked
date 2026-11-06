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
import { displaySymbol } from "@/lib/cryptoKey";
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
    const list = tracked ?? [];
    return list.map((t, i) => ({
      id: t.symbol,
      label: (
        <span className="flex items-center gap-1">
          <MoveArrows
            symbol={t.symbol}
            canUp={i > 0}
            canDown={i < list.length - 1}
          />
          {/* Fixed width so a long company name scrolls inside its own cell
            instead of widening the column; × stays pinned at the right edge. */}
          <span className="flex w-20 items-start gap-2">
            <span className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
              {t.market === "crypto" ? (
                // The ticker leads; the coin name under it tells apart coins
                // that share a ticker.
                <Link
                  href={`/stocks/${encodeURIComponent(t.symbol)}`}
                  className="flex flex-col leading-tight hover:underline"
                >
                  <span className="font-mono text-sm font-semibold">
                    {displaySymbol(t.symbol, t.market)}
                  </span>
                  {t.name && (
                    <span className="whitespace-nowrap text-xs text-muted">
                      {t.name}
                    </span>
                  )}
                </Link>
              ) : t.market !== "us" && t.name ? (
                // KR / JP codes are opaque, so the company name leads.
                <Link
                  href={`/stocks/${encodeURIComponent(t.symbol)}`}
                  className="flex flex-col leading-tight hover:underline"
                >
                  {/* Hangul falls back to a system font that renders larger
                    than Geist at the same size, so KR steps down a pixel. */}
                  <span
                    className={`font-semibold ${t.market === "kr" ? "text-[13px]" : "text-sm"}`}
                  >
                    {t.name}
                  </span>
                  <span className="text-xs text-muted">
                    ({MARKET_TAG[t.market]} · {t.symbol})
                  </span>
                </Link>
              ) : (
                <Link
                  href={`/stocks/${encodeURIComponent(t.symbol)}`}
                  className="font-mono font-semibold hover:underline"
                >
                  {displaySymbol(t.symbol, t.market)}
                </Link>
              )}
            </span>
            <button
              onClick={() => store.removeTrackedStock(t.symbol)}
              className="shrink-0 text-xs text-muted hover:text-down"
              title="Stop tracking (keeps history)"
            >
              ×
            </button>
          </span>
        </span>
      ),
      columns: toColumns(bySymbol.get(t.symbol) ?? [], "stock"),
      format: (n: number) => formatStockPrice(n, t.market),
      digits: (v: number) => stockDigits(t.market, v),
      groupZeros: t.market === "crypto",
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

/** ↑ / ↓ swap a row with its neighbour; greyed out at the ends of the list. */
function MoveArrows({
  symbol,
  canUp,
  canDown,
}: {
  symbol: string;
  canUp: boolean;
  canDown: boolean;
}) {
  // 16×24 targets: narrow to save row-label width, full height to stay
  // tappable, with a gap so a thumb can't land on both. `touch-manipulation`
  // drops the double-tap-zoom delay.
  const cls =
    "flex h-6 w-4 touch-manipulation items-center justify-center rounded-md leading-none text-muted hover:bg-background hover:text-foreground active:bg-background disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted";
  return (
    // -ml-2 cancels the row-head cell's left padding (shared with Currency,
    // so it's undone here rather than removed there).
    <span className="-my-1.5 -ml-2 flex shrink-0 flex-col gap-1 text-[11px]">
      <button
        type="button"
        className={cls}
        disabled={!canUp}
        onClick={() => store.moveTrackedStock(symbol, "up")}
        aria-label="Move up"
        title="Move up"
      >
        ▲
      </button>
      <button
        type="button"
        className={cls}
        disabled={!canDown}
        onClick={() => store.moveTrackedStock(symbol, "down")}
        aria-label="Move down"
        title="Move down"
      >
        ▼
      </button>
    </span>
  );
}
