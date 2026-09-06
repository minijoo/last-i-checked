import type { ReactNode } from "react";
import { unionAxis } from "@/lib/matrix";
import { formatAmerican, type OddsColumn } from "@/lib/sportsbook";
import { rowHeadClass, Shell } from "./CheckMatrix";
import { OddsDelta } from "./OddsDelta";

export interface SportsbookRow {
  id: string;
  label: ReactNode;
  columns: OddsColumn[]; // newest first, from toOddsColumns()
}

const cellBlank = <span className="text-muted">·</span>;

/** One home-page section's table: shared half-day axis, one row per pinned
 *  outcome. Cell = American odds + the implied-probability delta. */
export function SportsbookMatrix({
  rows,
  maxCols = 5,
}: {
  rows: SportsbookRow[];
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
                  <div className="font-mono tabular-nums">
                    {cell.status === "unavailable"
                      ? "—"
                      : formatAmerican(cell.price)}
                  </div>
                  <div className="text-xs">
                    <OddsDelta pp={cell.probDeltaPP} />
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
