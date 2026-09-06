import { formatClock, formatStamp } from "@/lib/format";
import { formatAmerican, formatPoint, type OddsColumn } from "@/lib/sportsbook";
import { LineMove, OddsDelta } from "./OddsDelta";

/**
 * Columnar odds + delta view for the detail page. Newest half-day bucket on the
 * left. The odds are shown literally (American); the delta below is the
 * implied-probability move; a line move, when there is one, is spelled out.
 */
export function SportsbookColumns({
  columns,
  emptyLabel = "No checks yet.",
}: {
  columns: OddsColumn[];
  emptyLabel?: string;
}) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto">
      {columns.map((c, i) => {
        const prev = columns[i + 1];
        const title =
          c.probDeltaPP === null
            ? `First recorded check, ${formatStamp(c.at)}`
            : `${formatAmerican(c.price)} on ${c.label} vs ${
                prev ? formatAmerican(prev.price) : "?"
              } on ${prev?.label ?? "?"}`;
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
            <div className="mt-1 font-mono text-lg tabular-nums">
              {c.status === "unavailable" ? "—" : formatAmerican(c.price)}
            </div>
            {c.point !== null && c.status === "ok" && (
              <div className="text-xs tabular-nums text-muted">
                {formatPoint(c.point)}
              </div>
            )}
            <div className="mt-0.5 text-xs">
              <OddsDelta pp={c.probDeltaPP} />
            </div>
            <LineMove
              from={prev?.point ?? null}
              to={c.point}
              className="mt-0.5 block text-[0.7rem]"
            />
          </div>
        );
      })}
    </div>
  );
}
