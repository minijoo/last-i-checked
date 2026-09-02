"use client";

import Link from "next/link";
import { useMemo } from "react";
import { parseCalendarKey } from "@/lib/format";
import type { WeatherCheck } from "@/lib/types";
import {
  fmtRain,
  fmtTemp,
  numColumnsFor,
  skyColumnsFor,
  splitDayNight,
  type WeatherView,
} from "@/lib/weather-view";
import { DeltaColumns } from "./DeltaColumns";
import { SkyColumns } from "./SkyColumns";
import { Card } from "./ui";

const COLUMNS = 4;

export function WeatherCard({
  location,
  calKey,
  view,
  checks,
  pinned = false,
  onUnpin,
}: {
  location: string;
  calKey: string;
  view: WeatherView;
  checks: WeatherCheck[];
  pinned?: boolean;
  onUnpin?: () => void;
}) {
  const relevant = useMemo(
    () =>
      checks.filter(
        (c) => c.location === location && c.dateStr.slice(0, 8) === calKey,
      ),
    [checks, location, calKey],
  );
  const { day, night } = splitDayNight(relevant);
  const unit = relevant[0]?.tempUnit ?? "F";
  const dateLabel = parseCalendarKey(calKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  function row(label: string, subset: WeatherCheck[]) {
    return (
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted">{label}</div>
        {view === "sky" ? (
          <SkyColumns columns={skyColumnsFor(subset, COLUMNS)} emptyLabel="—" />
        ) : (
          <DeltaColumns
            columns={numColumnsFor(subset, view, COLUMNS)}
            format={view === "temp" ? fmtTemp(unit) : fmtRain}
            digits={0}
            emptyLabel="—"
          />
        )}
      </div>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/weather/day?loc=${encodeURIComponent(location)}&date=${calKey}`}
          className="text-sm font-semibold hover:underline"
        >
          {location} · {dateLabel}
        </Link>
        {pinned && onUnpin && (
          <button
            onClick={onUnpin}
            className="shrink-0 text-xs text-muted hover:text-down"
            title="Unpin (keeps history)"
          >
            unpin
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {row("Day", day)}
        {row("Night", night)}
      </div>
    </Card>
  );
}
