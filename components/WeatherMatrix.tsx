import type { ReactNode } from "react";
import type { NumColumn } from "@/lib/buckets";
import { formatStamp } from "@/lib/format";
import { relDaySpans, unionAxis } from "@/lib/matrix";
import { Delta } from "./Delta";

/** One horizontal band of a weather row. `label` (e.g. "AM"/"PM") is shown as a
 *  small bordered pill; omit it for a single-band row (rain). */
export interface WeatherLane {
  key: string;
  label?: ReactNode;
  columns: NumColumn[]; // newest first, from toColumns()
  format?: (n: number) => string; // overrides the table-level format for this lane
  digits?: number; // overrides the table-level digits for this lane's delta
}

export interface WeatherRow {
  id: string;
  label: ReactNode; // two-line date header, spans the row's lanes
  lanes: WeatherLane[];
}

const cellBlank = <span className="text-muted">·</span>;

/**
 * Weather-only variant of {@link NumMatrix}: a row can split into stacked lanes
 * that share the date axis. The date header spans the lanes; each lane carries
 * its own small pill label (AM/PM) aligned to that lane's data.
 */
export function WeatherMatrix({
  rows,
  format = (n) => n.toFixed(2),
  digits = 2,
  maxCols = 6,
}: {
  rows: WeatherRow[];
  format?: (n: number) => string;
  digits?: number;
  maxCols?: number;
}) {
  const axis = unionAxis(
    rows.flatMap((r) => r.lanes.map((l) => l.columns)),
    maxCols,
  );
  const spans = relDaySpans(axis);
  const hasLaneLabels = rows.some((r) => r.lanes.some((l) => l.label != null));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th
              rowSpan={3}
              className="sticky left-0 z-10 w-px bg-surface px-2 py-1.5 text-left font-medium"
            />
            {hasLaneLabels && <th rowSpan={3} className="w-px px-1 py-1.5" />}
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
          {rows.map((r) =>
            r.lanes.map((lane, li) => {
              const byKey = new Map(lane.columns.map((c) => [c.key, c]));
              return (
                <tr
                  key={`${r.id}-${lane.key}`}
                  className={li === 0 ? "border-t border-border" : ""}
                >
                  {li === 0 && (
                    <th
                      rowSpan={r.lanes.length}
                      className="sticky left-0 z-10 w-px bg-surface px-2 py-2 text-left align-middle font-medium whitespace-nowrap"
                    >
                      {r.label}
                    </th>
                  )}
                  {hasLaneLabels && (
                    <td className="w-px px-1 py-2 text-center align-middle whitespace-nowrap">
                      {lane.label && (
                        <span className="inline-block rounded border border-border px-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted">
                          {lane.label}
                        </span>
                      )}
                    </td>
                  )}
                  {axis.map((c) => {
                    const cell = byKey.get(c.key);
                    if (!cell) {
                      return (
                        <td key={c.key} className="px-2 py-2 text-center">
                          {cellBlank}
                        </td>
                      );
                    }
                    const fmt = lane.format ?? format;
                    const dig = lane.digits ?? digits;
                    const older =
                      lane.columns[
                        lane.columns.findIndex((x) => x.key === c.key) + 1
                      ];
                    const title =
                      cell.delta === null
                        ? `First recorded check, ${formatStamp(cell.at)}`
                        : `${fmt(cell.value)} on ${cell.label}${
                            older ? ` vs ${fmt(older.value)} on ${older.label}` : ""
                          }`;
                    return (
                      <td
                        key={c.key}
                        title={title}
                        className="px-2 py-2 text-center"
                      >
                        <div className="font-mono tabular-nums">
                          {fmt(cell.value)}
                        </div>
                        <div className="text-xs">
                          <Delta value={cell.delta} digits={dig} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
