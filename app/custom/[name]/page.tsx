"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { CheckGraph } from "@/components/CheckGraph";
import { CustomColumns } from "@/components/CustomColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { toCustomColumns } from "@/lib/customColumns";
import { runCustomFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import { useCustomChecks, useTrackedCustoms } from "@/lib/hooks";

export default function CustomDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = use(params);
  const name = decodeURIComponent(raw);
  const checks = useCustomChecks(name);
  const tracked = useTrackedCustoms();
  const trackedItem = (tracked ?? []).find((t) => t.name === name);

  const okChecks = useMemo(
    () => (checks ?? []).filter((c) => c.status === "ok"),
    [checks],
  );
  const points = useMemo(
    () =>
      okChecks
        .filter((c): c is typeof c & { value: number } => typeof c.value === "number")
        .map((c) => ({ t: c.checkedAt, v: c.value })),
    [okChecks],
  );
  const columns = useMemo(
    () =>
      toCustomColumns(
        okChecks.map((c) => ({ checkedAt: c.checkedAt, value: c.value! })),
      ),
    [okChecks],
  );
  const rows = checks ? [...checks].reverse() : undefined; // newest first
  const latest = checks && checks.length > 0 ? checks[checks.length - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/custom" className="text-sm text-muted hover:text-foreground">
          ← Custom checks
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {latest && (
              <p
                className="mt-1 truncate text-sm text-muted"
                title={latest.status === "error" ? latest.errorMessage : undefined}
              >
                {latest.status === "ok"
                  ? String(latest.value)
                  : `last fetch failed: ${latest.errorMessage}`}{" "}
                · as of {formatStamp(latest.checkedAt)}
              </p>
            )}
            {trackedItem && (
              <p className="mt-1 truncate text-xs text-muted" title={trackedItem.url}>
                {trackedItem.url} · <span className="font-mono">{trackedItem.selector}</span>
              </p>
            )}
          </div>
          {trackedItem && (
            <FetchBar onFetch={() => runCustomFetch(trackedItem)} label="Fetch" />
          )}
        </div>
      </div>

      {checks === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : checks.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">No checks recorded for {name} yet.</p>
        </Card>
      ) : (
        <>
          {points.length >= 2 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Graph</SectionTitle>
              <Card>
                <CheckGraph points={points} />
              </Card>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionTitle>By day, latest</SectionTitle>
            <CustomColumns columns={columns} />
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>Full history</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 pr-4 font-normal">When</th>
                    <th className="py-1 font-normal">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows!.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap py-1 pr-4 text-muted">
                        {formatStamp(c.checkedAt)}
                      </td>
                      <td
                        className={`whitespace-nowrap py-1 font-mono ${
                          c.status === "error" ? "text-down" : ""
                        }`}
                        title={c.status === "error" ? c.errorMessage : c.rawText}
                      >
                        {c.status === "error" ? (c.errorMessage ?? "error") : String(c.value)}
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
