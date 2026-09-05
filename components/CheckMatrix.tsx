import type { ReactNode } from "react";
import type { NumColumn } from "@/lib/buckets";
import { formatStamp } from "@/lib/format";
import { unionAxis } from "@/lib/matrix";
import { Delta } from "./Delta";

export interface NumRow {
  id: string;
  label: ReactNode;
  columns: NumColumn[]; // newest first, from toColumns()
}

const cellBlank = <span className="text-muted">·</span>;

/** Shared table shell (date axis + sticky row-label column). Also used by
 *  CustomMatrix, which needs the same layout for non-numeric columns. */
export function Shell({
  axis,
  children,
}: {
  axis: { key: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium" />
            {axis.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-2 py-1.5 text-center font-medium"
              >
                {c.label}
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

/** Consolidated numeric table: shared date axis, one row per item. */
export function NumMatrix({
  rows,
  format = (n) => n.toFixed(2),
  digits = 2,
  maxCols = 6,
}: {
  rows: NumRow[];
  format?: (n: number) => string;
  digits?: number;
  maxCols?: number;
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
                    <Delta value={cell.delta} digits={digits} />
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
