// Delta-baseline bucketing for custom checks — mirrors toColumns() in
// lib/buckets.ts, but tolerates a text value: a bucket's delta is only
// computed when it and the previous populated bucket are both numbers.

import { bucketKey, bucketLabel } from "./buckets";

export interface CustomDatum {
  checkedAt: number;
  value: number | string;
}

export interface CustomColumn {
  key: string;
  label: string;
  at: number;
  value: number | string;
  delta: number | null;
}

function round(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export function toCustomColumns(
  data: CustomDatum[],
  limit = Number.POSITIVE_INFINITY,
): CustomColumn[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a.checkedAt - b.checkedAt);
  const byBucket = new Map<string, CustomDatum>();
  for (const d of sorted) byBucket.set(bucketKey(d.checkedAt, "custom"), d);
  const keys = [...byBucket.keys()];

  const cols: CustomColumn[] = keys.map((key, i) => {
    const d = byBucket.get(key)!;
    const prev = i > 0 ? byBucket.get(keys[i - 1]) : undefined;
    const delta =
      typeof d.value === "number" && prev && typeof prev.value === "number"
        ? round(d.value - prev.value)
        : null;
    return { key, label: bucketLabel(key), at: d.checkedAt, value: d.value, delta };
  });
  cols.reverse(); // newest first
  return Number.isFinite(limit) ? cols.slice(0, limit) : cols;
}
