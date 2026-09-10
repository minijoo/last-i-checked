import type { ReactNode } from "react";
import type { NumColumn } from "@/lib/buckets";
import { formatStamp, pctChange } from "@/lib/format";
import { type AxisCol, relDaySpans, unionAxis } from "@/lib/matrix";
import { Delta } from "./Delta";

export interface NumRow {
  id: string;
  label: ReactNode;
  columns: NumColumn[]; // newest first, from toColumns()
}

const cellBlank = <span className="text-muted">·</span>;

/** Shared table shell: a two-row date axis (relative day merged over absolute
 *  dates) plus the sticky row-label column. Also used by CustomMatrix. */
export function Shell({
  axis,
  children,
}: {
  axis: AxisCol[];
  children: ReactNode;
}) {
  const spans = relDaySpans(axis);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th
              rowSpan={3}
              className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium"
            />
            {spans.map((g) => (
              <th
                key={g.key}
                colSpan={g.span}
                className="whitespace-nowrap px-2 pt-1.5 pb-0.5 text-center font-medium"
              >
                {g.relLabel}
              </th>
            ))}
          </tr>
          <tr className="text-[0.7rem] text-muted">
            {axis.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-2 text-center font-normal"
              >
                {c.absLabel}
              </th>
            ))}
          </tr>
          <tr className="text-[0.65rem] text-muted">
            {axis.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-2 pb-1.5 text-center font-normal opacity-80"
              >
                {c.timeLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const rowHeadClass =
  "sticky left-0 z-10 bg-surface px-2 py-2 text-left align-top font-medium whitespace-nowrap";

/** Consolidated numeric table: shared date axis, one row per item.
 *  With `percent`, each delta is shown as a percent change from the previous
 *  populated column ((value − prev) / prev × 100), fixed at 2 decimals. */
export function NumMatrix({
  rows,
  format = (n) => n.toFixed(2),
  digits = 2,
  maxCols = 6,
  percent = false,
}: {
  rows: NumRow[];
  format?: (n: number) => string;
  digits?: number;
  maxCols?: number;
  percent?: boolean;
}) {
  const axis = unionAxis(
    rows.map((r) => r.columns),
    maxCols,
  );
  return (
    <Shell axis={axis}>
      {rows.map((r) => {
        const byKey = new Map(r.columns.map((c) => [c.key, c]));
        return (
          <tr key={r.id} className="border-t border-border">
            <th className={rowHeadClass}>{r.label}</th>
            {axis.map((c) => {
              const cell = byKey.get(c.key);
              if (!cell) {
                return (
                  <td key={c.key} className="px-2 py-2 text-center">
                    {cellBlank}
                  </td>
                );
              }
              const older =
                r.columns[r.columns.findIndex((x) => x.key === c.key) + 1];
              // Percent change off the previous populated column. null (→ "—")
              // for the oldest column and when the baseline is 0.
              const pctDelta = pctChange(cell.delta, cell.value);
              const title =
                cell.delta === null
                  ? `First recorded check, ${formatStamp(cell.at)}`
                  : `${format(cell.value)} on ${cell.label}${
                      older
                        ? ` vs ${format(older.value)} on ${older.label}`
                        : ""
                    }`;
              return (
                <td key={c.key} title={title} className="px-2 py-2 text-center">
                  <div className="font-mono tabular-nums">
                    {format(cell.value)}
                  </div>
                  <div className="text-xs">
                    {percent ? (
                      <Delta value={pctDelta} digits={2} suffix="%" />
                    ) : (
                      <Delta value={cell.delta} digits={digits} />
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        );
      })}
    </Shell>
  );
}
