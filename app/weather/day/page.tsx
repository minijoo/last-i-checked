"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { CheckGraph } from "@/components/CheckGraph";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { SkyColumns } from "@/components/SkyColumns";
import { Card, SectionTitle } from "@/components/ui";
import { runWeatherFetch } from "@/lib/fetchers";
import { parseCalendarKey } from "@/lib/format";
import { useWeatherChecks } from "@/lib/hooks";
import {
  fmtRain,
  fmtTemp,
  numColumnsFor,
  skyColumnsFor,
  splitDayNight,
} from "@/lib/weather-view";
import type { WeatherCheck } from "@/lib/types";

export default function WeatherDayPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <DayView />
    </Suspense>
  );
}

function DayView() {
  const sp = useSearchParams();
  const location = sp.get("loc") ?? "";
  const calKey = sp.get("date") ?? "";
  const checks = useWeatherChecks(location, calKey);

  const dateLabel = calKey
    ? parseCalendarKey(calKey).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const { day, night } = useMemo(
    () => splitDayNight(checks ?? []),
    [checks],
  );

  if (!location || !calKey) {
    return <p className="text-sm text-down">Missing location or date.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/weather"
          className="text-sm text-muted hover:text-foreground"
        >
          ← Weather
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{location}</h1>
            <p className="mt-1 text-sm text-muted">{dateLabel}</p>
          </div>
          <FetchBar onFetch={runWeatherFetch} label="Fetch forecasts" />
        </div>
      </div>

      {checks === undefined ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : checks.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            No checks recorded for this location and date yet.
          </p>
        </Card>
      ) : (
        <>
          <HalfDay label="Day" checks={day} />
          <HalfDay label="Night" checks={night} />
        </>
      )}
    </div>
  );
}

function HalfDay({ label, checks }: { label: string; checks: WeatherCheck[] }) {
  const unit = checks[0]?.tempUnit ?? "F";
  if (checks.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <SectionTitle>{label}</SectionTitle>
        <p className="text-sm text-muted">No {label.toLowerCase()} checks.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{label}</SectionTitle>
      <Card>
        <CheckGraph
          points={checks.map((c) => ({ t: c.checkedAt, v: c.temp }))}
          unit={`°${unit}`}
          digits={0}
        />
      </Card>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted">Temperature</div>
        <DeltaColumns
          columns={numColumnsFor(checks, "temp")}
          format={fmtTemp(unit)}
          digits={0}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted">Rain probability</div>
        <DeltaColumns
          columns={numColumnsFor(checks, "rain")}
          format={fmtRain}
          digits={0}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-xs font-medium text-muted">Sky</div>
        <SkyColumns columns={skyColumnsFor(checks)} />
      </div>
    </section>
  );
}
