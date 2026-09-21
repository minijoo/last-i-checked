"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LuArrowRight } from "react-icons/lu";
import { AddCurrencyForm } from "@/components/AddCurrencyForm";
import { NumMatrix, type NumRow } from "@/components/CheckMatrix";
import { FetchBar } from "@/components/FetchBar";
import { MatrixFrame } from "@/components/MatrixFrame";
import { Card } from "@/components/ui";
import { toColumns } from "@/lib/buckets";
import { useCurrencyList } from "@/lib/currencyList";
import { runCurrencyFetch } from "@/lib/fetchers";
import { formatRate, rateDecimals } from "@/lib/format";
import {
  useAllCurrencyChecks,
  useDeltaMode,
  useTrackedCurrencies,
} from "@/lib/hooks";
import { store } from "@/lib/store";

export default function CurrencyPage() {
  const tracked = useTrackedCurrencies();
  const checks = useAllCurrencyChecks();
  const { currencies } = useCurrencyList();
  const asPercent = useDeltaMode("currency") === "pct";
  const loading = tracked === undefined || checks === undefined;

  const rows = useMemo<NumRow[]>(() => {
    const names = new Map((currencies ?? []).map((c) => [c.code, c.name]));
    const byPair = new Map<string, { checkedAt: number; value: number }[]>();
    for (const c of checks ?? []) {
      const arr = byPair.get(c.pair) ?? [];
      arr.push({ checkedAt: c.checkedAt, value: c.rate });
      byPair.set(c.pair, arr);
    }
    return (tracked ?? []).map((t) => ({
      id: t.pair,
      label: (
        <span className="flex items-center gap-2">
          <Link
            href={`/currency/${t.base}-${t.target}`}
            title={`${names.get(t.base) ?? t.base} → ${names.get(t.target) ?? t.target}`}
            className="flex items-center gap-1 font-mono font-semibold hover:underline"
          >
            {t.base}
            <LuArrowRight aria-hidden className="text-muted" />
            {t.target}
          </Link>
          <button
            onClick={() => store.removeTrackedCurrency(t.pair)}
            className="text-xs text-muted hover:text-down"
            title="Stop tracking (keeps history)"
          >
            ×
          </button>
        </span>
      ),
      columns: toColumns(byPair.get(t.pair) ?? [], "currency"),
    }));
  }, [tracked, checks, currencies]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Currency</h1>
          <p className="mt-1 text-sm text-muted">
            How each exchange rate has moved since the last day you checked.
          </p>
        </div>
        <FetchBar onFetch={runCurrencyFetch} label="Fetch rates" />
      </div>

      <AddCurrencyForm />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No pairs tracked yet. Pick a base and a target above, then hit{" "}
            <span className="text-foreground">Fetch rates</span>.
          </p>
        </Card>
      ) : (
        <Card>
          <MatrixFrame page="currency">
            <NumMatrix
              rows={rows}
              format={formatRate}
              digits={rateDecimals}
              percent={asPercent}
            />
          </MatrixFrame>
          <p className="mt-3 text-xs text-muted">
            Each row reads <span className="text-foreground">base → target</span>:
            how much target one unit of base buys. Rates update once per business
            day, so several fetches in a day (or over a weekend) can show no
            change. Columns are the days you fetched; the{" "}
            <span className="text-foreground">%</span> toggle switches deltas
            between absolute and percent change.
          </p>
        </Card>
      )}
    </div>
  );
}
