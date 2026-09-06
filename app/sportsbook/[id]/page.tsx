"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { CheckGraph, DualAxisGraph } from "@/components/CheckGraph";
import { FetchBar } from "@/components/FetchBar";
import { SportsbookColumns } from "@/components/SportsbookColumns";
import { Card, SectionTitle } from "@/components/ui";
import { runSportsbookFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import { useSportsbookChecks, useTrackedSportsbook } from "@/lib/hooks";
import {
  formatAmerican,
  formatPoint,
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

  const okChecks = useMemo(
    () => (checks ?? []).filter((c) => c.status === "ok" && c.price !== null),
    [checks],
  );
  const hasPoint = useMemo(
    () => (checks ?? []).some((c) => c.point !== null),
    [checks],
  );

  // Price-only graph (h2h / futures), and a dual-axis Line+Odds graph otherwise.
  const pricePoints = useMemo(
    () => okChecks.map((c) => ({ t: c.checkedAt, v: c.price as number })),
    [okChecks],
  );
  const dualPoints = useMemo(
    () =>
      okChecks
        .filter((c) => c.point !== null)
        .map((c) => ({
          t: c.checkedAt,
          left: c.point as number,
          right: c.price as number,
        })),
    [okChecks],
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
          {hasPoint
            ? dualPoints.length >= 2 && (
                <section className="flex flex-col gap-2">
                  <SectionTitle>Line &amp; odds</SectionTitle>
                  <Card>
                    <DualAxisGraph
                      points={dualPoints}
                      leftLabel="Line"
                      rightLabel="Odds"
                      leftDigits={1}
                      rightDigits={0}
                    />
                  </Card>
                </section>
              )
            : pricePoints.length >= 2 && (
                <section className="flex flex-col gap-2">
                  <SectionTitle>Odds</SectionTitle>
                  <Card>
                    <CheckGraph points={pricePoints} digits={0} />
                  </Card>
                </section>
              )}

          <section className="flex flex-col gap-2">
            <SectionTitle>By half-day, latest</SectionTitle>
            {hasPoint ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Line</span>
                  <SportsbookColumns columns={columns} metric="line" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted">Odds</span>
                  <SportsbookColumns columns={columns} metric="price" />
                </div>
              </div>
            ) : (
              <SportsbookColumns columns={columns} metric="price" />
            )}
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>Full history</SectionTitle>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1 pr-4 font-normal">When</th>
                    <th className="py-1 pr-4 font-normal">Line</th>
                    <th className="py-1 font-normal">Odds</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap py-1 pr-4 text-muted">
                        {formatStamp(c.checkedAt)}
                      </td>
                      <td className="whitespace-nowrap py-1 pr-4 font-mono tabular-nums text-muted">
                        {c.point != null ? formatPoint(c.point) : "—"}
                      </td>
                      <td
                        className={`whitespace-nowrap py-1 font-mono tabular-nums ${
                          c.status === "unavailable" ? "text-muted" : ""
                        }`}
                      >
                        {c.status === "unavailable"
                          ? "n/a"
                          : formatAmerican(c.price)}
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
