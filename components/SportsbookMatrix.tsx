import type { ReactNode } from "react";
import { relDaySpans, unionAxis } from "@/lib/matrix";
import { formatAmerican, formatPoint, type OddsColumn } from "@/lib/sportsbook";
import { Delta } from "./Delta";

export interface SportsbookRow {
  id: string;
  label: ReactNode;
  columns: OddsColumn[]; // newest first, from toOddsColumns()
}

const cellBlank = <span className="text-muted">·</span>;

type LaneKind = "line" | "price";

/**
 * One home-page section's table. A row splits into stacked lanes that share the
 * half-day axis: outcomes with a `point` (spreads, totals, props) get a **Line**
 * lane and an **Odds** lane, each with its own value + delta; moneyline / futures
 * outcomes get just the **Odds** lane. Header rows: relative day (merged) over
 * absolute date over the time of that bucket's latest check.
 */
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
  const spans = relDaySpans(axis);
  const hasPoint = rows.some((r) => r.columns.some((c) => c.point !== null));
  const lanes: LaneKind[] = hasPoint ? ["line", "price"] : ["price"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th
              rowSpan={3}
              className="sticky left-0 z-10 w-px bg-surface px-2 py-1.5 text-left font-medium"
            />
            {hasPoint && <th rowSpan={3} className="w-px px-1 py-1.5" />}
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
        <tbody>
          {rows.map((r) => {
            const byKey = new Map(r.columns.map((c) => [c.key, c]));
            return lanes.map((lane, li) => (
              <tr
                key={`${r.id}-${lane}`}
                className={li === 0 ? "border-t border-border" : ""}
              >
                {li === 0 && (
                  <th
                    rowSpan={lanes.length}
                    className="sticky left-0 z-10 w-px bg-surface px-2 py-2 text-left align-top font-medium whitespace-nowrap"
                  >
                    {r.label}
                  </th>
                )}
                {hasPoint && (
                  <td className="w-px px-1 py-2 text-center align-middle">
                    <span className="inline-block rounded border border-border px-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted">
                      {lane === "line" ? "Line" : "Odds"}
                    </span>
                  </td>
                )}
                {axis.map((c) => {
                  const col = byKey.get(c.key);
                  const value =
                    lane === "line" ? col?.point ?? null : col?.price ?? null;
                  if (!col || value === null) {
                    return (
                      <td key={c.key} className="px-2 py-2 text-center">
                        {cellBlank}
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className="px-2 py-2 text-center">
                      <div className="font-mono tabular-nums">
                        {lane === "line"
                          ? formatPoint(value)
                          : formatAmerican(value)}
                      </div>
                      <div className="text-xs">
                        <Delta
                          value={
                            lane === "line" ? col.pointDelta : col.priceDelta
                          }
                          digits={lane === "line" ? 1 : 0}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
