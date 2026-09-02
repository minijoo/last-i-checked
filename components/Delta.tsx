import { deltaDirection, formatDelta } from "@/lib/format";

/** A signed delta: green ▲ up, red ▼ down, grey flat, "—" when there's no baseline. */
export function Delta({
  value,
  digits = 2,
  className = "",
}: {
  value: number | null;
  digits?: number;
  className?: string;
}) {
  const dir = deltaDirection(value);
  if (dir === "none") {
    return <span className={`text-muted ${className}`}>—</span>;
  }
  const color =
    dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-muted";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
  return (
    <span className={`tabular-nums ${color} ${className}`}>
      <span aria-hidden className="text-[0.85em]">
        {arrow}
      </span>{" "}
      {formatDelta(value as number, digits)}
    </span>
  );
}
