import { bucketLabel } from "./buckets.ts";
import { formatClock, relativeDayLabel } from "./format.ts";

export interface AxisCol {
  key: string; // bucket key: "2026-09-04" or "2026-09-04-PM"
  dayKey: string; // "2026-09-04" — calendar day (for merging the relative-date row)
  absLabel: string; // "9/4" or "9/4 PM"
  relLabel: string; // "today" / "2 days ago"
  timeLabel: string; // "10:51PM" — time of the latest check in the bucket ("" if unknown)
}

/**
 * Shared column axis for the consolidated tables: the union of every row's
 * bucket keys, newest first, capped at `maxCols`. Bucket keys sort
 * chronologically as plain strings ("2026-09-02" > "2026-09-01-PM" > "…-AM").
 * Columns are headed by an absolute date; a merged row above shows the relative
 * day (see {@link relDaySpans}).
 */
export function unionAxis(
  perRow: Array<Array<{ key: string; at?: number }>>,
  maxCols = 6,
): AxisCol[] {
  // Per bucket key, keep the latest check time seen across all rows (rows in one
  // table are normally fetched together, so this is just "when this bucket was
  // last checked").
  const latestAt = new Map<string, number>();
  for (const cols of perRow) {
    for (const c of cols) {
      const prev = latestAt.get(c.key) ?? 0;
      const at = c.at ?? 0;
      if (!latestAt.has(c.key) || at > prev) latestAt.set(c.key, at);
    }
  }
  return [...latestAt.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, maxCols)
    .map((key) => {
      const at = latestAt.get(key)!;
      return {
        key,
        dayKey: key.slice(0, 10),
        absLabel: bucketLabel(key),
        relLabel: relativeDayLabel(key),
        timeLabel: at ? formatClock(at) : "",
      };
    });
}

export interface RelSpan {
  key: string; // key of the first column in the run (for React keys)
  relLabel: string;
  span: number; // how many adjacent columns share this calendar day
}

/** Collapse runs of adjacent columns from the same calendar day into one
 *  header cell, so two half-day buckets on 9/4 sit under a single "2 days ago". */
export function relDaySpans(axis: AxisCol[]): RelSpan[] {
  const out: RelSpan[] = [];
  let prevDay: string | null = null;
  for (const c of axis) {
    if (out.length > 0 && prevDay === c.dayKey) {
      out[out.length - 1].span += 1;
    } else {
      out.push({ key: c.key, relLabel: c.relLabel, span: 1 });
    }
    prevDay = c.dayKey;
  }
  return out;
}
