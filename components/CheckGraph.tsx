"use client";

import {
  CartesianGrid,
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
  const data = [...points].sort((a, b) => a.t - b.t);
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
