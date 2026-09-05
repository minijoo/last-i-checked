"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AddCustomCheckForm } from "@/components/AddCustomCheckForm";
import { CustomCheckCard } from "@/components/CustomCheckCard";
import { CustomMatrix, type CustomMatrixRow } from "@/components/CustomMatrix";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { toCustomColumns } from "@/lib/customColumns";
import { runCustomFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import { useAllCustomChecks, useTrackedCustoms } from "@/lib/hooks";
import { store } from "@/lib/store";

const MAIN_COLS = 4;
const MAX_ERRORS = 10;

export default function CustomPage() {
  const tracked = useTrackedCustoms();
  const checks = useAllCustomChecks();
  const loading = tracked === undefined || checks === undefined;

  // Text values are kept out of the shared-column matrix entirely — a long
  // string would distort every other row's column width — and get their own
  // card instead, same as before the matrix view existed.
  const numericTracked = useMemo(
    () => (tracked ?? []).filter((t) => t.valueType === "number"),
    [tracked],
  );
  const textTracked = useMemo(
    () => (tracked ?? []).filter((t) => t.valueType === "text"),
    [tracked],
  );
  const numericNames = useMemo(
    () => new Set(numericTracked.map((t) => t.name)),
    [numericTracked],
  );

  const rows = useMemo<CustomMatrixRow[]>(() => {
    const byName = new Map<string, { checkedAt: number; value: number | string }[]>();
    for (const c of checks ?? []) {
      if (c.status !== "ok" || !numericNames.has(c.name)) continue; // errors, and text checks, are surfaced elsewhere
      const arr = byName.get(c.name) ?? [];
      arr.push({ checkedAt: c.checkedAt, value: c.value! });
      byName.set(c.name, arr);
    }
    return numericTracked.map((t) => ({
      id: t.name,
      label: (
        <div className="flex flex-col items-start gap-1.5">
          <span className="flex items-center gap-2">
            <Link
              href={`/custom/${encodeURIComponent(t.name)}`}
              className="font-semibold hover:underline"
            >
              {t.name}
            </Link>
            <button
              onClick={() => store.removeTrackedCustom(t.name)}
              className="text-xs text-muted hover:text-down"
              title="Stop tracking (keeps history)"
            >
              ×
            </button>
          </span>
          <FetchBar onFetch={() => runCustomFetch(t)} label="Fetch" />
        </div>
      ),
      columns: toCustomColumns(byName.get(t.name) ?? [], MAIN_COLS),
    }));
  }, [numericTracked, numericNames, checks]);

  // Text-check errors show inline in their own card's history table instead.
  const recentErrors = useMemo(
    () =>
      (checks ?? [])
        .filter((c) => c.status === "error" && numericNames.has(c.name))
        .sort((a, b) => b.checkedAt - a.checkedAt)
        .slice(0, MAX_ERRORS),
    [checks, numericNames],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Custom checks</h1>
        <p className="mt-1 text-sm text-muted">
          Track any value on any page by URL and CSS selector. Finding a selector
          needs a desktop browser&apos;s devtools — running a check works from any
          device.
        </p>
      </div>

      <AddCustomCheckForm />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (tracked?.length ?? 0) === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nothing tracked yet. Add a name, URL, and CSS selector above.
          </p>
        </Card>
      ) : (
        <>
          {rows.length > 0 && (
            <Card>
              <CustomMatrix rows={rows} maxCols={MAIN_COLS} />
              <p className="mt-3 text-xs text-muted">
                Columns are the last {MAIN_COLS} days you fetched successfully. Open a
                check for its full history and graph.
              </p>
            </Card>
          )}

          {textTracked.length > 0 && (
            <section className="flex flex-col gap-3">
              {rows.length > 0 && <SectionTitle>Text checks</SectionTitle>}
              {textTracked.map((t) => (
                <CustomCheckCard key={t.name} tracked={t} />
              ))}
            </section>
          )}
        </>
      )}

      {recentErrors.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Recent errors
          </h2>
          <Card className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1 pr-4 font-normal">Check</th>
                  <th className="py-1 pr-4 font-normal">When</th>
                  <th className="py-1 font-normal">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentErrors.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="whitespace-nowrap py-1 pr-4 font-medium">
                      <Link
                        href={`/custom/${encodeURIComponent(c.name)}`}
                        className="hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-1 pr-4 text-muted">
                      {formatStamp(c.checkedAt)}
                    </td>
                    <td className="whitespace-nowrap py-1 text-down">
                      {c.errorMessage ?? "error"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
