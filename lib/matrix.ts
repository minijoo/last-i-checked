import { relativeDayLabel } from "./format";

export interface AxisCol {
  key: string;
  label: string;
}

/**
 * Shared column axis for the consolidated tables: the union of every row's
 * bucket keys, newest first, capped at `maxCols`. Bucket keys are built to sort
 * chronologically as plain strings ("2026-09-02" > "2026-09-01-PM" > "…-AM").
 * Headers read as relative days ("today", "1 day ago", "3 days ago").
 */
export function unionAxis(
  perRow: Array<Array<{ key: string }>>,
  maxCols = 6,
): AxisCol[] {
  const keys = new Set<string>();
  for (const cols of perRow) for (const c of cols) keys.add(c.key);
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, maxCols)
    .map((key) => ({ key, label: relativeDayLabel(key) }));
}
