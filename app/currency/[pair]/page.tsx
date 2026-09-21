"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { LuArrowRight } from "react-icons/lu";
import { CheckGraph } from "@/components/CheckGraph";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { toColumns } from "@/lib/buckets";
import { useCurrencyList } from "@/lib/currencyList";
import { runCurrencyFetch } from "@/lib/fetchers";
import { formatRate, formatStamp, rateDecimals } from "@/lib/format";
import { useCurrencyChecks } from "@/lib/hooks";

export default function CurrencyDetailPage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair: raw } = use(params);
  // URL form "USD-EUR" ("/" can't sit in a path segment) → stored "USD/EUR".
  const [base = "", target = ""] = decodeURIComponent(raw).toUpperCase().split("-");
  const pair = `${base}/${target}`;
  const checks = useCurrencyChecks(pair);
  const { currencies } = useCurrencyList();

  const nameOf = (code: string) =>
    currencies?.find((c) => c.code === code)?.name ?? code;

  const points = useMemo(
    () => (checks ?? []).map((c) => ({ t: c.checkedAt, v: c.rate })),
    [checks],
  );
  const columns = useMemo(
    () =>
      toColumns(
        (checks ?? []).map((c) => ({ checkedAt: c.checkedAt, value: c.rate })),
        "currency",
      ),
    [checks],
  );
  const latest = checks && checks.length > 0 ? checks[checks.length - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/currency" className="text-sm text-muted hover:text-foreground">
          ← Currency
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-mono text-2xl font-semibold">
              {base}
              <LuArrowRight aria-hidden className="text-muted" />
              {target}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {nameOf(base)} → {nameOf(target)}
              {latest &&
                ` · 1 ${base} = ${formatRate(latest.rate)} ${target} · as of ${formatStamp(latest.checkedAt)}`}
            </p>
          </div>
          <FetchBar onFetch={runCurrencyFetch} label="Fetch rates" />
        </div>
      </div>

      {checks === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : checks.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No checks recorded for {pair} yet.</p>
        </Card>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <SectionTitle>Every check</SectionTitle>
            <Card>
              <CheckGraph
                points={points}
                digits={latest ? rateDecimals(latest.rate) : 4}
              />
            </Card>
          </section>
          <section className="flex flex-col gap-2">
            <SectionTitle>By day, latest</SectionTitle>
            <DeltaColumns
              columns={columns}
              format={formatRate}
              digits={rateDecimals}
            />
          </section>
          <section className="flex flex-col gap-2">
            <SectionTitle>Full history</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 pr-4 font-normal">When</th>
                    <th className="py-1 pr-4 font-normal">Rate</th>
                    <th className="py-1 font-normal">Rate as of</th>
                  </tr>
                </thead>
                <tbody>
                  {[...checks].reverse().map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap py-1 pr-4 text-muted">
                        {formatStamp(c.checkedAt)}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-4 font-mono tabular-nums">
                        {formatRate(c.rate)}
                      </td>
                      <td className="whitespace-nowrap py-1 text-muted">
                        {c.rateDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
