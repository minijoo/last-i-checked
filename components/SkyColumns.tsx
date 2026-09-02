import type { TextColumn } from "@/lib/buckets";
import { formatStamp } from "@/lib/format";

/** Text variant of DeltaColumns for sky condition: "changed" / "same" vs the prior column. */
export function SkyColumns({
  columns,
  emptyLabel = "No checks yet.",
}: {
  columns: TextColumn[];
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
          title={
            c.changed === null
              ? `First recorded check, ${formatStamp(c.at)}`
              : c.changed
                ? `Changed since ${columns[i + 1]?.label ?? "before"}`
                : `Same as ${columns[i + 1]?.label ?? "before"}`
          }
          className={`flex min-w-[8rem] shrink-0 flex-col rounded-lg border px-3 py-2 ${
            i === 0 ? "border-border bg-surface" : "border-transparent bg-surface/50"
          }`}
        >
          <div className="text-xs text-muted">{c.label}</div>
          <div className="mt-1 flex-1 text-sm leading-snug">{c.value}</div>
          <div className="mt-1 text-xs">
            {c.changed === null ? (
              <span className="text-muted">—</span>
            ) : c.changed ? (
              <span className="text-foreground">changed</span>
            ) : (
              <span className="text-muted">same</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
