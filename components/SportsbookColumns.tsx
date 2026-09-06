import { formatClock, formatStamp } from "@/lib/format";
import { formatAmerican, formatPoint, type OddsColumn } from "@/lib/sportsbook";
import { Delta } from "./Delta";

/**
 * Detail-page half-day strip for one sportsbook metric. `metric="line"` shows
 * the `point` value + its delta; `metric="price"` shows the American odds +
 * their delta. Newest bucket on the left. Deltas are plain arithmetic
 * differences (line in points, price in American-odds units).
 */
export function SportsbookColumns({
  columns,
  metric,
  emptyLabel = "No checks yet.",
}: {
  columns: OddsColumn[];
  metric: "line" | "price";
  emptyLabel?: string;
}) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto">
      {columns.map((c, i) => {
        const raw = metric === "line" ? c.point : c.price;
        const delta = metric === "line" ? c.pointDelta : c.priceDelta;
        const digits = metric === "line" ? 1 : 0;
        const shown =
          c.status === "unavailable" || raw === null
            ? "—"
            : metric === "line"
              ? formatPoint(raw)
              : formatAmerican(raw);
        const prev = columns[i + 1];
        const prevRaw = prev
          ? metric === "line"
            ? prev.point
            : prev.price
          : null;
        const title =
          delta === null
            ? `First recorded check, ${formatStamp(c.at)}`
            : `${shown} on ${c.label} vs ${prevRaw ?? "?"} on ${
                prev?.label ?? "?"
              }`;
        return (
          <div
            key={c.key}
            title={title}
            className={`min-w-[6.5rem] shrink-0 rounded-lg border px-3 py-2 text-center ${
              i === 0
                ? "border-border bg-surface"
                : "border-transparent bg-surface/50"
            }`}
          >
            <div className="text-xs text-muted">{c.label}</div>
            <div className="text-[0.65rem] text-muted opacity-80">
              {formatClock(c.at)}
            </div>
            <div className="mt-1 font-mono text-lg tabular-nums">{shown}</div>
            <div className="mt-0.5 text-xs">
              <Delta value={delta} digits={digits} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
