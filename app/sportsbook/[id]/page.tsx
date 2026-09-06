"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { CheckGraph } from "@/components/CheckGraph";
import { FetchBar } from "@/components/FetchBar";
import { SportsbookColumns } from "@/components/SportsbookColumns";
import { Card, SectionTitle } from "@/components/ui";
import { runSportsbookFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import { useSportsbookChecks, useTrackedSportsbook } from "@/lib/hooks";
import {
  formatAmerican,
  formatPoint,
  impliedProb,
  makeTrackKey,
  toOddsColumns,
} from "@/lib/sportsbook";

export default function SportsbookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = use(params);
  const id = Number(raw);

  const tracked = useTrackedSportsbook();
  const item = (tracked ?? []).find((t) => t.id === id) ?? null;
  const trackKey = item ? makeTrackKey(item) : "";
  const checks = useSportsbookChecks(trackKey);

  const [now] = useState(() => Date.now());
  const closed = item ? now >= item.commenceTime : false;

  const points = useMemo(
    () =>
      (checks ?? [])
        .filter((c) => c.status === "ok" && c.price !== null)
        .map((c) => ({ t: c.checkedAt, v: impliedProb(c.price as number) * 100 })),
    [checks],
  );

  const columns = useMemo(
    () =>
      toOddsColumns(
        (checks ?? []).map((c) => ({
          checkedAt: c.checkedAt,
          price: c.price,
          point: c.point,
          status: c.status,
        })),
      ),
    [checks],
  );

  const history = checks ? [...checks].reverse() : undefined;
  const latest =
    checks && checks.length > 0 ? checks[checks.length - 1] : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/sportsbook"
          className="text-sm text-muted hover:text-foreground"
        >
          ← Sportsbook
        </Link>

        {tracked !== undefined && !item ? (
          <Card className="mt-4">
            <p className="text-sm text-muted">
              This outcome isn&apos;t tracked anymore. Its history is kept — re-add
              it from the Sportsbook page to see it again.
            </p>
          </Card>
        ) : item ? (
          <>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold">
                  {item.outcomeDescription
                    ? `${item.outcomeDescription} · ${item.outcomeName}`
                    : item.outcomeName}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {item.eventName} · {item.marketLabel} · {item.bookmakerTitle} ·{" "}
                  {item.region.toUpperCase()}
                </p>
                {latest && (
                  <p className="mt-1 text-sm text-muted">
                    {latest.status === "unavailable"
                      ? "not offered right now"
                      : `${formatAmerican(latest.price)}${
                          latest.point != null
                            ? ` (${formatPoint(latest.point)})`
                            : ""
                        }`}{" "}
                    · as of {formatStamp(latest.checkedAt)}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {closed
                    ? "Closed — event has started; value is frozen."
                    : `Starts ${formatStamp(item.commenceTime)}`}
                </p>
              </div>
              {!closed && (
                <FetchBar
                  onFetch={() => runSportsbookFetch([item])}
                  label="Fetch odds (1 credit)"
                />
              )}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        )}
      </div>

      {item && checks !== undefined && (
        <>
          {points.length >= 2 && (
            <section className="flex flex-col gap-2">
              <SectionTitle>Implied probability</SectionTitle>
              <Card>
                <CheckGraph points={points} unit="%" digits={1} />
              </Card>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SectionTitle>By half-day, latest</SectionTitle>
            <SportsbookColumns columns={columns} />
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>Full history</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 pr-4 font-normal">When</th>
                    <th className="py-1 pr-4 font-normal">Odds</th>
                    <th className="py-1 pr-4 font-normal">Line</th>
                    <th className="py-1 font-normal">Implied</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap py-1 pr-4 text-muted">
                        {formatStamp(c.checkedAt)}
                      </td>
                      <td
                        className={`whitespace-nowrap py-1 pr-4 font-mono tabular-nums ${
                          c.status === "unavailable" ? "text-muted" : ""
                        }`}
                      >
                        {c.status === "unavailable"
                          ? "n/a"
                          : formatAmerican(c.price)}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-4 font-mono tabular-nums text-muted">
                        {c.point != null ? formatPoint(c.point) : "—"}
                      </td>
                      <td className="whitespace-nowrap py-1 font-mono tabular-nums text-muted">
                        {c.status === "unavailable" || c.price === null
                          ? "—"
                          : `${(impliedProb(c.price) * 100).toFixed(1)}%`}
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
