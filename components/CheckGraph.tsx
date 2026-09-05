"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatStamp } from "@/lib/format";

export interface GraphPoint {
  t: number; // epoch ms
  v: number;
}

export interface DualGraphPoint {
  t: number; // epoch ms
  a: number;
  b: number;
}

export interface DualAxisPoint {
  t: number; // epoch ms
  left: number;
  right: number;
}

/**
 * Rounds to the same precision the axis/tooltip display at. Without this, a
 * series whose true values differ only below that precision (e.g. rain
 * amounts converted from mm that differ by a few ten-thousandths of an inch)
 * makes recharts auto-scale the Y axis to that imperceptible true range —
 * every tick then rounds to the same displayed label ("0.00" everywhere)
 * while the line still visibly wanders within a range the axis can't convey.
 * Rounding first collapses insignificant noise so the chart and its labels
 * agree on what's actually distinguishable.
 */
function roundToDigits(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Line graph of every raw check for one item (detail pages plot all points). */
export function CheckGraph({
  points,
  unit = "",
  digits = 2,
}: {
  points: GraphPoint[];
  unit?: string;
  digits?: number;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        Need at least two checks to draw a graph.
      </p>
    );
  }
  const data = [...points]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({ ...p, v: roundToDigits(p.v, digits) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatStamp(Number(t))}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            stroke="var(--border)"
            minTickGap={40}
          />
          <YAxis
            width={48}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${Number(v).toFixed(digits)}`}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
            labelFormatter={(t) => formatStamp(Number(t))}
            formatter={(v) => [`${Number(v).toFixed(digits)}${unit}`, "value"]}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--foreground)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-series variant (e.g. day/night temperature) sharing one time axis.
 *  Hovering shows both series' values at that point — recharts' default
 *  Tooltip behavior for multiple Lines on the same chart. The second line
 *  is dashed as well as differently colored, so the two stay distinguishable
 *  without relying on color alone. */
export function DualCheckGraph({
  points,
  aLabel,
  bLabel,
  unit = "",
  digits = 2,
}: {
  points: DualGraphPoint[];
  aLabel: string;
  bLabel: string;
  unit?: string;
  digits?: number;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        Need at least two checks to draw a graph.
      </p>
    );
  }
  const data = [...points]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({
      ...p,
      a: roundToDigits(p.a, digits),
      b: roundToDigits(p.b, digits),
    }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatStamp(Number(t))}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            stroke="var(--border)"
            minTickGap={40}
          />
          <YAxis
            width={48}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${Number(v).toFixed(digits)}`}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
            labelFormatter={(t) => formatStamp(Number(t))}
            formatter={(v, name) => [`${Number(v).toFixed(digits)}${unit}`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            iconType="plainline"
          />
          <Line
            type="monotone"
            dataKey="a"
            name={aLabel}
            stroke="var(--day)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--day)" }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="b"
            name={bLabel}
            stroke="var(--night)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: "var(--night)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Two-series variant for series with different units (e.g. rain in inches
 * and wind speed in mph) — one shared time axis, but each series gets its
 * own Y axis (left/right) since a shared axis would be meaningless across
 * units. The right line reuses the --night color/dash from DualCheckGraph
 * for a consistent "second series" convention across the app, and each
 * axis's own tick labels are tinted to match their line's color so it's
 * clear which numbers belong to which series.
 */
export function DualAxisGraph({
  points,
  leftLabel,
  rightLabel,
  leftUnit = "",
  rightUnit = "",
  leftDigits = 2,
  rightDigits = 0,
}: {
  points: DualAxisPoint[];
  leftLabel: string;
  rightLabel: string;
  leftUnit?: string;
  rightUnit?: string;
  leftDigits?: number;
  rightDigits?: number;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        Need at least two checks to draw a graph.
      </p>
    );
  }
  const data = [...points]
    .sort((a, b) => a.t - b.t)
    .map((p) => ({
      ...p,
      left: roundToDigits(p.left, leftDigits),
      right: roundToDigits(p.right, rightDigits),
    }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatStamp(Number(t))}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            stroke="var(--border)"
            minTickGap={40}
          />
          <YAxis
            yAxisId="left"
            width={48}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${Number(v).toFixed(leftDigits)}`}
            tick={{ fill: "var(--foreground)", fontSize: 11 }}
            stroke="var(--border)"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            width={48}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${Number(v).toFixed(rightDigits)}`}
            tick={{ fill: "var(--night)", fontSize: 11 }}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
            }}
            labelFormatter={(t) => formatStamp(Number(t))}
            formatter={(v, name) =>
              name === rightLabel
                ? [`${Number(v).toFixed(rightDigits)}${rightUnit}`, name]
                : [`${Number(v).toFixed(leftDigits)}${leftUnit}`, name]
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
            iconType="plainline"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="left"
            name={leftLabel}
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--foreground)" }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="right"
            name={rightLabel}
            stroke="var(--night)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: "var(--night)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
