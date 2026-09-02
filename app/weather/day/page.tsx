"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckGraph } from "@/components/CheckGraph";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { runWeatherFetch } from "@/lib/fetchers";
import { mmToInches, parseCalendarKey } from "@/lib/format";
import { useWeatherChecks } from "@/lib/hooks";
import type { WeatherCheck } from "@/lib/types";
import { fmtRainInches, fmtTemp, numColumnsFor } from "@/lib/weather-view";

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

  if (!location || !calKey) {
    return <p className="text-sm text-down">Missing location or date.</p>;
  }

  const estimated = (checks ?? []).some((c) => c.source === "summary");
  const unit = checks?.[0]?.tempUnit ?? "F";

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
            <p className="mt-1 text-sm text-muted">
              {dateLabel}
              {estimated && " · estimated (day summary)"}
            </p>
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
          <Metric
            title="Day temperature"
            checks={checks}
            value={(c) => c.tempDay}
            format={fmtTemp(unit)}
            graphUnit={`°${unit}`}
            digits={0}
          />
          <Metric
            title="Night temperature"
            checks={checks}
            value={(c) => c.tempNight}
            format={fmtTemp(unit)}
            graphUnit={`°${unit}`}
            digits={0}
          />
          <Metric
            title="Rain"
            checks={checks}
            value={(c) => mmToInches(c.rainAmt)}
            metric="rain"
            format={fmtRainInches}
            graphUnit={'"'}
            digits={2}
          />
        </>
      )}
    </div>
  );
}

function Metric({
  title,
  checks,
  value,
  metric = "day",
  format,
  graphUnit,
  digits,
}: {
  title: string;
  checks: WeatherCheck[];
  value: (c: WeatherCheck) => number;
  metric?: "day" | "night" | "rain";
  format: (n: number) => string;
  graphUnit: string;
  digits: number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      <Card>
        <CheckGraph
          points={checks.map((c) => ({ t: c.checkedAt, v: value(c) }))}
          unit={graphUnit}
          digits={digits}
        />
      </Card>
      <DeltaColumns
        columns={numColumnsFor(checks, metric)}
        format={format}
        digits={digits}
      />
    </section>
  );
}
