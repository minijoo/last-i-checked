import type { NumColumn } from "@/lib/buckets";
import { formatClock, formatStamp } from "@/lib/format";
import { Delta } from "./Delta";

/**
 * The columnar value + delta view from docs/plan.md. Newest bucket on the left.
 * Adjacent date headers make each delta's baseline self-evident; the title
 * attribute spells it out on hover/tap.
 */
export function DeltaColumns({
  columns,
  format = (n) => n.toFixed(2),
  digits = 2,
  emptyLabel = "No checks yet.",
}: {
  columns: NumColumn[];
  format?: (n: number) => string;
  digits?: number;
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
          c.delta === null
            ? `First recorded check, ${formatStamp(c.at)}`
            : `${format(c.value)} on ${c.label} vs ${prev ? format(prev.value) : "?"} on ${
                prev?.label ?? "?"
              }`;
        return (
          <div
            key={c.key}
            title={title}
            className={`min-w-[5.5rem] shrink-0 rounded-lg border px-3 py-2 text-center ${
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
              {format(c.value)}
            </div>
            <div className="mt-0.5 text-xs">
              <Delta value={c.delta} digits={digits} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
