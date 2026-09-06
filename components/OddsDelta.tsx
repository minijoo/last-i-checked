// Sportsbook deltas. `price` moves are shown as an implied-probability change
// in percentage points (never a raw American-odds subtraction — the ±100
// discontinuity makes that meaningless). `point` moves are plain numbers.

/** Implied-probability change, in percentage points. Up = the outcome got more
 *  likely (odds shortened). */
export function OddsDelta({
  pp,
  className = "",
}: {
  pp: number | null;
  className?: string;
}) {
  if (pp === null) {
    return <span className={`text-muted ${className}`}>—</span>;
  }
  const shown = Number(pp.toFixed(1));
  const dir = shown > 0 ? "up" : shown < 0 ? "down" : "flat";
  const color =
    dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-muted";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
  const sign = shown > 0 ? "+" : shown < 0 ? "-" : "";
  return (
    <span
      className={`tabular-nums ${color} ${className}`}
      title={`implied probability ${sign}${Math.abs(shown).toFixed(1)} pts (odds ${
        dir === "up" ? "shortened" : dir === "down" ? "lengthened" : "unchanged"
      })`}
    >
      <span aria-hidden className="text-[0.85em]">
        {arrow}
      </span>{" "}
      {`${sign}${Math.abs(shown).toFixed(1)}`} pts
    </span>
  );
}

/** "line 45.5 → 43.5" — only rendered when the line actually moved. */
export function LineMove({
  from,
  to,
  className = "",
}: {
  from: number | null;
  to: number | null;
  className?: string;
}) {
  if (from === null || to === null || from === to) return null;
  return (
    <span className={`tabular-nums text-muted ${className}`}>
      line {from} → {to}
    </span>
  );
}
