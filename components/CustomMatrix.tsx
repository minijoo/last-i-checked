import type { ReactNode } from "react";
import type { CustomColumn } from "@/lib/customColumns";
import { unionAxis } from "@/lib/matrix";
import { rowHeadClass, Shell } from "./CheckMatrix";
import { Delta } from "./Delta";

export interface CustomMatrixRow {
  id: string;
  label: ReactNode;
  columns: CustomColumn[]; // newest first, from toCustomColumns() — "ok" checks only
}

const cellBlank = <span className="text-muted">·</span>;

/** Consolidated custom-checks table: shared date axis, one row per tracked
 *  check. Values may be numbers or text; deltas only render where numeric. */
export function CustomMatrix({
  rows,
  maxCols = 4,
}: {
  rows: CustomMatrixRow[];
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
              return (
                <td key={c.key} className="px-2 py-2 text-center">
                  <div
                    className="mx-auto max-w-[8rem] truncate font-mono tabular-nums"
                    title={String(cell.value)}
                  >
                    {String(cell.value)}
                  </div>
                  {cell.delta !== null && (
                    <div className="text-xs">
                      <Delta value={cell.delta} />
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </Shell>
  );
}
