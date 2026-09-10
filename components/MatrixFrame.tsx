"use client";

import type { ReactNode } from "react";
import { type DeltaPage, toggleDeltaMode, useDeltaMode } from "@/lib/hooks";

/**
 * Wraps one matrix table with a floating "%" toggle pinned to its top-left
 * corner — over the table's always-empty corner header cell — so showing the
 * toggle never shifts the table from where it sat without it.
 *
 * The toggle flips that whole page's delta mode (absolute ↔ percent), which is
 * a single persisted setting: a page may render several MatrixFrames (one per
 * event section, per pinned city, …) and they all read and write the same
 * `deltaMode:<page>` value. Placing a button on each table is a convenience,
 * not a per-table scope.
 */
export function MatrixFrame({
  page,
  children,
}: {
  page: DeltaPage;
  children: ReactNode;
}) {
  const mode = useDeltaMode(page);
  const asPercent = mode === "pct";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => toggleDeltaMode(page, mode)}
        aria-pressed={asPercent}
        title={
          asPercent
            ? "Showing percent changes — click for absolute"
            : "Showing absolute changes — click for percent"
        }
        className={`absolute left-0 top-0 z-20 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          asPercent
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-surface text-muted hover:text-foreground"
        }`}
      >
        %
      </button>
      {children}
    </div>
  );
}
