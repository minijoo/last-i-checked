import { type CustomColumn, CUSTOM_DELTA_DIGITS } from "@/lib/customColumns";
import { formatClock } from "@/lib/format";
import { Delta } from "./Delta";

/** Detail-page "by day" strip for one custom check. Same shape as
 *  DeltaColumns, but values may be text — delta only renders where numeric. */
export function CustomColumns({
  columns,
  emptyLabel = "No checks yet.",
}: {
  columns: CustomColumn[];
  emptyLabel?: string;
}) {
  if (columns.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto">
      {columns.map((c, i) => (
        <div
          key={c.key}
          className={`min-w-[5.5rem] shrink-0 rounded-lg border px-3 py-2 text-center ${
            i === 0 ? "border-border bg-surface" : "border-transparent bg-surface/50"
          }`}
        >
          <div className="text-xs text-muted">{c.label}</div>
          <div className="text-[0.65rem] text-muted opacity-80">
            {formatClock(c.at)}
          </div>
          <div className="mt-1 truncate font-mono text-lg tabular-nums" title={String(c.value)}>
            {String(c.value)}
          </div>
          {c.delta !== null && (
            <div className="mt-0.5 text-xs">
              <Delta value={c.delta} digits={CUSTOM_DELTA_DIGITS} trimZeros />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
