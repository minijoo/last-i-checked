// Delta-baseline bucketing. See docs/plan.md "Delta baseline".
//
// A bucket is one distinct calendar day (stocks) or one distinct half-day, split
// at local noon (weather). A bucket's value is its LAST check. A column's delta is
// its value minus the next-older populated bucket's value. Newest column first;
// the oldest shown column (and any first-ever check) has no delta.
//
// Buckets only exist where checks exist, so gaps (weekends, market holidays,
// travel) simply produce no column — the delta then spans to whenever the user
// last checked, which the date headers make legible.

export type Domain = "stock" | "weather";

export interface NumDatum {
  checkedAt: number; // epoch ms
  value: number;
}

export interface TextDatum {
  checkedAt: number;
  value: string;
}

export interface NumColumn {
  key: string; // bucket id, e.g. "2026-09-01" or "2026-09-01-PM"
  label: string; // header text, e.g. "Sep 1" or "Sep 1 PM"
  at: number; // checkedAt of the representative (last) check in the bucket
  value: number;
  delta: number | null; // value - previous column's value; null for oldest
}

export interface TextColumn {
  key: string;
  label: string;
  at: number;
  value: string;
  changed: boolean | null; // vs previous column; null for oldest
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export function bucketKey(ts: number, domain: Domain): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const base = `${y}-${m}-${day}`;
  if (domain === "stock") return base;
  return d.getHours() < 12 ? `${base}-AM` : `${base}-PM`;
}

export function bucketLabel(key: string): string {
  const [y, m, d, half] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const md = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return half ? `${md} ${half}` : md;
}

/** Group chronologically, one entry per bucket keeping the last datum. */
function groupByBucket<T extends { checkedAt: number }>(
  data: T[],
  domain: Domain,
): { keys: string[]; byBucket: Map<string, T> } {
  const sorted = [...data].sort((a, b) => a.checkedAt - b.checkedAt);
  const byBucket = new Map<string, T>();
  for (const d of sorted) byBucket.set(bucketKey(d.checkedAt, domain), d);
  // Map keeps first-insertion order, which is chronological after the sort.
  return { keys: [...byBucket.keys()], byBucket };
}

export function toColumns(
  data: NumDatum[],
  domain: Domain,
  limit = Number.POSITIVE_INFINITY,
): NumColumn[] {
  if (data.length === 0) return [];
  const { keys, byBucket } = groupByBucket(data, domain);
  const cols: NumColumn[] = keys.map((key, i) => {
    const d = byBucket.get(key)!;
    const prev = i > 0 ? byBucket.get(keys[i - 1])! : null;
    return {
      key,
      label: bucketLabel(key),
      at: d.checkedAt,
      value: d.value,
      delta: prev ? round(d.value - prev.value) : null,
    };
  });
  cols.reverse(); // newest first
  return Number.isFinite(limit) ? cols.slice(0, limit) : cols;
}

export function toTextColumns(
  data: TextDatum[],
  domain: Domain,
  limit = Number.POSITIVE_INFINITY,
): TextColumn[] {
  if (data.length === 0) return [];
  const { keys, byBucket } = groupByBucket(data, domain);
  const cols: TextColumn[] = keys.map((key, i) => {
    const d = byBucket.get(key)!;
    const prev = i > 0 ? byBucket.get(keys[i - 1])! : null;
    return {
      key,
      label: bucketLabel(key),
      at: d.checkedAt,
      value: d.value,
      changed: prev ? prev.value !== d.value : null,
    };
  });
  cols.reverse();
  return Number.isFinite(limit) ? cols.slice(0, limit) : cols;
}
