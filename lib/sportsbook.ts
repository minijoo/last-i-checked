// Sportsbook odds helpers — American-odds math, identity keys, and the
// half-day delta bucketing. See docs/sportsbook.md.

import { bucketKey, bucketLabel } from "./buckets.ts";

export const REGIONS = ["us", "us2", "uk", "eu", "au"] as const;
export type Region = (typeof REGIONS)[number];
export const DEFAULT_REGION: Region = "us";

/** The by-value coordinate that links a TrackedSportsbook row to its checks.
 *  `point` is deliberately excluded — a line move must not orphan history. */
export function makeTrackKey(t: {
  sportKey: string;
  eventId: string;
  region: string;
  bookmakerKey: string;
  marketKey: string;
  outcomeName: string;
  outcomeDescription: string | null;
}): string {
  return [
    t.sportKey,
    t.eventId,
    t.region,
    t.bookmakerKey,
    t.marketKey,
    t.outcomeName,
    t.outcomeDescription ?? "",
  ].join("|");
}

/** American odds → implied probability (with vig). Continuous and monotonic,
 *  so differences of these are meaningful where raw American-odds differences
 *  are not (the ±100 discontinuity). */
export function impliedProb(price: number): number {
  return price < 0 ? -price / (-price + 100) : 100 / (price + 100);
}

/** Implied-probability change in percentage points, prev → curr. */
export function probDeltaPP(prev: number, curr: number): number {
  return round((impliedProb(curr) - impliedProb(prev)) * 100);
}

/** "+150" / "-110" / "—" for a missing price. */
export function formatAmerican(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return "—";
  return price > 0 ? `+${price}` : `${price}`;
}

/** The line as shown next to the odds: "-2.5", "45.5", "1.5". Negative keeps
 *  its sign; positives are shown bare (the outcome name carries the rest of
 *  the meaning). "" when there is no line (moneyline / futures). */
export function formatPoint(point: number | null): string {
  if (point === null || !Number.isFinite(point)) return "";
  return String(point);
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

// ---- Delta bucketing (half-day, split at local noon) ----

export interface OddsDatum {
  checkedAt: number;
  price: number | null;
  point: number | null;
  status: "ok" | "unavailable";
}

export interface OddsColumn {
  key: string; // bucket id, "2026-09-06-PM"
  label: string; // "Sep 6 PM"
  at: number; // checkedAt of the representative (last) check
  price: number | null;
  point: number | null;
  status: "ok" | "unavailable";
  probDeltaPP: number | null; // implied-prob change vs the next-older bucket, in pp
  pointDelta: number | null; // line change vs the next-older bucket
}

/** Group checks into half-day buckets keeping the last check per bucket, then
 *  compute each bucket's delta against the next-older populated bucket. Newest
 *  column first. Mirrors toColumns() in lib/buckets.ts. */
export function toOddsColumns(
  data: OddsDatum[],
  limit = Number.POSITIVE_INFINITY,
): OddsColumn[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a.checkedAt - b.checkedAt);
  const byBucket = new Map<string, OddsDatum>();
  for (const d of sorted) byBucket.set(bucketKey(d.checkedAt, "sportsbook"), d);
  const keys = [...byBucket.keys()];

  const cols: OddsColumn[] = keys.map((key, i) => {
    const d = byBucket.get(key)!;
    const prev = i > 0 ? byBucket.get(keys[i - 1])! : null;
    const priceMoved =
      d.price !== null && prev != null && prev.price !== null
        ? probDeltaPP(prev.price, d.price)
        : null;
    const lineMoved =
      d.point !== null && prev != null && prev.point !== null
        ? round(d.point - prev.point)
        : null;
    return {
      key,
      label: bucketLabel(key),
      at: d.checkedAt,
      price: d.price,
      point: d.point,
      status: d.status,
      probDeltaPP: priceMoved,
      pointDelta: lineMoved,
    };
  });
  cols.reverse(); // newest first
  return Number.isFinite(limit) ? cols.slice(0, limit) : cols;
}
