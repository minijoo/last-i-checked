"use client";

import { useState, type ComponentProps } from "react";
import { CheckGraph, type GraphPoint } from "@/components/CheckGraph";
import { Card, SectionTitle } from "@/components/ui";

const SHARES = [100, 50, 25, 10] as const;
type Share = (typeof SHARES)[number];

/** The most recent `pct`% of points (by time), rounding the count up. */
export function lastShare<T extends { t: number }>(points: T[], pct: number): T[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const n = Math.ceil((sorted.length * pct) / 100);
  return sorted.slice(sorted.length - n);
}

/**
 * "Checks Plotted" section: a single-series check graph with a picker for how
 * much of the history to plot (the last 100/50/25/10% of checks). Long-running
 * items accumulate enough checks to crowd the graph; this trims it to the
 * recent tail without touching the stored data.
 */
export function PlottedChecks({
  points,
  ...graphProps
}: { points: GraphPoint[] } & Omit<ComponentProps<typeof CheckGraph>, "points">) {
  const [share, setShare] = useState<Share>(100);
  const shown = lastShare(points, share);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Checks Plotted</SectionTitle>
        <div
          role="radiogroup"
          aria-label="Share of checks to plot"
          className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-xs"
        >
          {SHARES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={share === s}
              onClick={() => setShare(s)}
              className={`rounded-full px-2.5 py-0.5 tabular-nums transition-colors ${
                share === s
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>
      <Card>
        <CheckGraph points={shown} {...graphProps} />
        <p className="mt-1 text-right text-xs text-muted tabular-nums">
          {shown.length} of {points.length} checks
        </p>
      </Card>
    </section>
  );
}
