"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { CheckGraph } from "@/components/CheckGraph";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { toColumns } from "@/lib/buckets";
import { runStockFetch } from "@/lib/fetchers";
import { formatPrice, formatStamp } from "@/lib/format";
import { useStockChecks } from "@/lib/hooks";

export default function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = use(params);
  const symbol = decodeURIComponent(raw).toUpperCase();
  const checks = useStockChecks(symbol);

  const points = useMemo(
    () => (checks ?? []).map((c) => ({ t: c.checkedAt, v: c.price })),
    [checks],
  );
  const columns = useMemo(
    () =>
      toColumns(
        (checks ?? []).map((c) => ({ checkedAt: c.checkedAt, value: c.price })),
        "stock",
      ),
    [checks],
  );
  const latest = checks && checks.length > 0 ? checks[checks.length - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/stocks" className="text-sm text-muted hover:text-foreground">
          ← Stocks
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold">{symbol}</h1>
            {latest && (
              <p className="mt-1 text-sm text-muted">
                {formatPrice(latest.price)} · as of {formatStamp(latest.checkedAt)}
              </p>
            )}
          </div>
          <FetchBar onFetch={runStockFetch} label="Fetch prices" />
        </div>
      </div>

      {checks === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : checks.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No checks recorded for {symbol} yet.
          </p>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <SectionTitle>Every check</SectionTitle>
            <Card>
              <CheckGraph points={points} />
            </Card>
          </section>
          <section className="flex flex-col gap-2">
            <SectionTitle>By day</SectionTitle>
            <DeltaColumns columns={columns} format={formatPrice} />
          </section>
        </>
      )}
    </div>
  );
}
