import { formatDelta } from "@/lib/format";

/** A signed delta: green ▲ up, red ▼ down, grey flat, "—" when there's no
 *  baseline. `digits` is the precision; with `trimZeros` it's a cap and
 *  trailing zeros are dropped (e.g. custom checks tracking batting average).
 *  `suffix` is appended to the number (e.g. "%" for percent-change mode). */
export function Delta({
  value,
  digits = 2,
  trimZeros = false,
  suffix = "",
  className = "",
}: {
  value: number | null;
  digits?: number;
  trimZeros?: boolean;
  suffix?: string;
  className?: string;
}) {
  if (value === null) {
    return <span className={`text-muted ${className}`}>—</span>;
  }
  // Classify by the value as displayed, so a change that rounds to 0 reads flat
  // rather than showing a coloured arrow next to "0".
  const shown = Number(value.toFixed(digits));
  const dir = shown > 0 ? "up" : shown < 0 ? "down" : "flat";
  const color =
    dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-muted";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
  const body =
    dir === "flat"
      ? trimZeros
        ? "0"
        : (0).toFixed(digits)
      : formatDelta(shown, digits, trimZeros);
  return (
    <span className={`tabular-nums ${color} ${className}`}>
      <span aria-hidden className="text-[0.85em]">
        {arrow}
      </span>{" "}
      {body}
      {suffix}
    </span>
  );
}
