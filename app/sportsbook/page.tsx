"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddSportsbookForm } from "@/components/AddSportsbookForm";
import { FetchBar } from "@/components/FetchBar";
import { MatrixFrame } from "@/components/MatrixFrame";
import {
  SportsbookMatrix,
  type SportsbookRow,
} from "@/components/SportsbookMatrix";
import { Card, SectionTitle } from "@/components/ui";
import { runSportsbookFetch } from "@/lib/fetchers";
import { formatStamp } from "@/lib/format";
import {
  useAllSportsbookChecks,
  useDeltaMode,
  useSportsbookAccess,
  useTrackedSportsbook,
} from "@/lib/hooks";
import { makeTrackKey, toOddsColumns } from "@/lib/sportsbook";
import { store } from "@/lib/store";
import type { SportsbookCheck, TrackedSportsbook } from "@/lib/types";

interface Section {
  key: string;
  rows: TrackedSportsbook[];
  eventName: string;
  marketLabel: string;
  region: string;
  commenceTime: number;
  closed: boolean;
}

export default function SportsbookPage() {
  const tracked = useTrackedSportsbook();
  const checks = useAllSportsbookChecks();
  const access = useSportsbookAccess();
  const asPercent = useDeltaMode("sportsbook") === "pct";
  const loading = tracked === undefined || checks === undefined;

  const groups = useMemo(() => {
    const byKey = new Map<string, TrackedSportsbook[]>();
    for (const t of tracked ?? []) {
      const k = `${t.eventId}|${t.marketKey}|${t.region}`;
      const arr = byKey.get(k) ?? [];
      arr.push(t);
      byKey.set(k, arr);
    }
    return [...byKey.entries()].map(([key, rows]) => ({
      key,
      rows,
      eventName: rows[0].eventName,
      marketLabel: rows[0].marketLabel,
      region: rows[0].region,
      commenceTime: rows[0].commenceTime,
    }));
  }, [tracked]);

  // `closed` is time-dependent; snapshot "now" once per mount (the app's model
  // is a fresh look each visit, and pages re-mount on navigation).
  const [now] = useState(() => Date.now());
  const sections: Section[] = groups
    .map((g) => ({ ...g, closed: now >= g.commenceTime }))
    .sort((a, b) =>
      a.closed !== b.closed
        ? a.closed
          ? 1
          : -1
        : a.commenceTime - b.commenceTime,
    );

  const checksByKey = useMemo(() => {
    const m = new Map<string, SportsbookCheck[]>();
    for (const c of checks ?? []) {
      const arr = m.get(c.trackKey) ?? [];
      arr.push(c);
      m.set(c.trackKey, arr);
    }
    return m;
  }, [checks]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sportsbook</h1>
        <p className="mt-1 text-sm text-muted">
          How a line you pinned has moved since you last checked — never against
          another book, only against your own history.
        </p>
        {access &&
          (access.userKey ? (
            <p className="mt-1 text-xs text-muted">Using your own Odds API key.</p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Trial credits:{" "}
              <span className="text-foreground">
                {access.trialUsed} of {access.trialLimit}
              </span>{" "}
              used this month.{" "}
              <Link href="/settings" className="underline hover:text-foreground">
                Add your own key in Settings
              </Link>{" "}
              for more.
            </p>
          ))}
      </div>

      <AddSportsbookForm />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : sections.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Nothing tracked yet. Use the form above to pin a number.
          </p>
        </Card>
      ) : (
        sections.map((sec) => {
          const rows: SportsbookRow[] = sec.rows.map((t) => {
            const trackKey = makeTrackKey(t);
            const cks = checksByKey.get(trackKey) ?? [];
            return {
              id: trackKey,
              label: (
                <span className="flex flex-col items-start gap-0.5">
                  <span className="flex items-center gap-2">
                    <Link
                      href={`/sportsbook/${t.id}`}
                      className="font-semibold hover:underline"
                    >
                      {t.outcomeDescription
                        ? `${t.outcomeDescription} · ${t.outcomeName}`
                        : t.outcomeName}
                    </Link>
                    <button
                      onClick={() => t.id != null && store.removeTrackedSportsbook(t.id)}
                      className="text-xs text-muted hover:text-down"
                      title="Stop tracking (keeps history)"
                    >
                      ×
                    </button>
                  </span>
                  <span className="text-xs font-normal text-muted">
                    {t.bookmakerTitle}
                  </span>
                </span>
              ),
              columns: toOddsColumns(
                cks.map((c) => ({
                  checkedAt: c.checkedAt,
                  price: c.price,
                  point: c.point,
                  status: c.status,
                })),
              ),
            };
          });

          return (
            <section key={sec.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <SectionTitle>
                  {sec.eventName} · {sec.marketLabel} · {sec.region.toUpperCase()}
                </SectionTitle>
                <span className="text-xs text-muted">
                  {sec.closed
                    ? "closed — value frozen"
                    : `starts ${formatStamp(sec.commenceTime)}`}
                </span>
              </div>
              <Card className="flex flex-col gap-3">
                <MatrixFrame page="sportsbook">
                  <SportsbookMatrix rows={rows} percent={asPercent} />
                </MatrixFrame>
                {sec.closed ? (
                  <p className="text-xs text-muted">
                    Event has started. The app stays out of live betting, so this
                    section no longer fetches.
                  </p>
                ) : (
                  <FetchBar
                    onFetch={() => runSportsbookFetch(sec.rows)}
                    label="Fetch odds (1 credit)"
                  />
                )}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
