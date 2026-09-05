"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DualAxisGraph, DualCheckGraph } from "@/components/CheckGraph";
import { DeltaColumns } from "@/components/DeltaColumns";
import { FetchBar } from "@/components/FetchBar";
import { Card, SectionTitle } from "@/components/ui";
import { runWeatherFetch } from "@/lib/fetchers";
import { mmToInches, parseCalendarKey } from "@/lib/format";
import { useWeatherChecks } from "@/lib/hooks";
import type { WeatherCheck } from "@/lib/types";
import { fmtRainInches, fmtTemp, fmtWindMph, numColumnsFor } from "@/lib/weather-view";

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
          <TempMetric checks={checks} unit={unit} />
          <RainWindMetric checks={checks} />
        </>
      )}
    </div>
  );
}

function TempMetric({ checks, unit }: { checks: WeatherCheck[]; unit: string }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Temperature</SectionTitle>
      <Card>
        <DualCheckGraph
          points={checks.map((c) => ({ t: c.checkedAt, a: c.tempDay, b: c.tempNight }))}
          aLabel="Day"
          bLabel="Night"
          unit={`°${unit}`}
          digits={0}
        />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Day</span>
          <DeltaColumns
            columns={numColumnsFor(checks, "day")}
            format={fmtTemp(unit)}
            digits={0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Night</span>
          <DeltaColumns
            columns={numColumnsFor(checks, "night")}
            format={fmtTemp(unit)}
            digits={0}
          />
        </div>
      </div>
    </section>
  );
}

function RainWindMetric({ checks }: { checks: WeatherCheck[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Rain &amp; wind</SectionTitle>
      <Card>
        <DualAxisGraph
          points={checks.map((c) => ({
            t: c.checkedAt,
            left: mmToInches(c.rainAmt),
            right: c.windSpeed,
          }))}
          leftLabel="Rain"
          rightLabel="Wind Speed"
          leftUnit={'"'}
          rightUnit=" mph"
          leftDigits={2}
          rightDigits={0}
        />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Rain</span>
          <DeltaColumns
            columns={numColumnsFor(checks, "rain")}
            format={fmtRainInches}
            digits={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Wind Speed</span>
          <DeltaColumns
            columns={numColumnsFor(checks, "wind")}
            format={fmtWindMph}
            digits={0}
          />
        </div>
      </div>
    </section>
  );
}
