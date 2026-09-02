"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NumMatrix, TextMatrix } from "@/components/CheckMatrix";
import { FetchBar } from "@/components/FetchBar";
import { LocationSearch } from "@/components/LocationSearch";
import { Button, Card, SectionTitle } from "@/components/ui";
import { HOME_WINDOW_DAYS, runWeatherFetch } from "@/lib/fetchers";
import { parseCalendarKey, todayCalendarKeys } from "@/lib/format";
import {
  useAllWeatherChecks,
  useHomeLocation,
  useTrackedForecasts,
} from "@/lib/hooks";
import { store } from "@/lib/store";
import type { WeatherCheck } from "@/lib/types";
import {
  fmtRain,
  fmtTemp,
  numColumnsFor,
  skyColumnsFor,
  VIEW_LABELS,
  type WeatherView,
} from "@/lib/weather-view";

interface Entry {
  location: string;
  calKey: string;
  showLocation?: boolean;
  note?: string;
}

const MS_DAY = 86_400_000;

function dayLabel(calKey: string) {
  return parseCalendarKey(calKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Why a pinned date has no data: it's outside the NWS forecast horizon. */
function horizonNote(calKey: string): string | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (parseCalendarKey(calKey).getTime() - today.getTime()) / MS_DAY,
  );
  if (days < 0) return "past date — NWS has no forecast for it";
  if (days > 7)
    return `${days} days out — beyond NWS's ~7-day forecast; fills in as it gets closer`;
  return undefined;
}

function WeatherTable({
  entries,
  checks,
  view,
}: {
  entries: Entry[];
  checks: WeatherCheck[];
  view: WeatherView;
}) {
  const rows = useMemo(() => {
    const out: { id: string; label: React.ReactNode; subset: WeatherCheck[] }[] =
      [];
    for (const e of entries) {
      for (const [suffix, tag] of [
        [".0", "Day"],
        [".1", "Night"],
      ] as const) {
        const subset = checks.filter(
          (c) => c.location === e.location && c.dateStr === `${e.calKey}${suffix}`,
        );
        out.push({
          id: `${e.location}-${e.calKey}-${suffix}`,
          label: (
            <span className="flex flex-col">
              <Link
                href={`/weather/day?loc=${encodeURIComponent(e.location)}&date=${e.calKey}`}
                className="hover:underline"
              >
                {e.showLocation ? `${e.location} · ` : ""}
                {dayLabel(e.calKey)} · {tag}
              </Link>
              {tag === "Day" && e.note && (
                <span className="mt-0.5 text-xs font-normal text-muted">
                  {e.note}
                </span>
              )}
            </span>
          ),
          subset,
        });
      }
    }
    return out;
  }, [entries, checks]);

  const unit = checks.find((c) => c.tempUnit)?.tempUnit ?? "F";

  if (view === "sky") {
    return (
      <TextMatrix
        rows={rows.map((r) => ({
          id: r.id,
          label: r.label,
          columns: skyColumnsFor(r.subset),
        }))}
      />
    );
  }
  return (
    <NumMatrix
      rows={rows.map((r) => ({
        id: r.id,
        label: r.label,
        columns: numColumnsFor(r.subset, view),
      }))}
      format={view === "temp" ? fmtTemp(unit) : fmtRain}
      digits={0}
    />
  );
}

export default function WeatherPage() {
  const home = useHomeLocation();
  const pins = useTrackedForecasts();
  const checks = useAllWeatherChecks();
  const [view, setView] = useState<WeatherView>("temp");

  const loading =
    home === undefined || pins === undefined || checks === undefined;
  const windowKeys = todayCalendarKeys(HOME_WINDOW_DAYS);

  const homeEntries: Entry[] = home
    ? windowKeys.map((k) => ({ location: home.name, calKey: k }))
    : [];
  const pinEntries: Entry[] = (pins ?? []).map((p) => ({
    location: p.location,
    calKey: p.forecastDate,
    showLocation: true,
    note: horizonNote(p.forecastDate),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Weather</h1>
          <p className="mt-1 text-sm text-muted">
            How the forecast has shifted since you last checked. US only (NWS).
          </p>
        </div>
        <FetchBar onFetch={runWeatherFetch} label="Fetch forecasts" />
      </div>

      <div className="flex gap-1">
        {(Object.keys(VIEW_LABELS) as WeatherView[]).map((v) => (
          <Button
            key={v}
            variant={view === v ? "solid" : "outline"}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle>
              Home {home ? `· ${home.name}` : "(not set)"}
            </SectionTitle>
            {home ? (
              <Card>
                <WeatherTable
                  entries={homeEntries}
                  checks={checks}
                  view={view}
                />
              </Card>
            ) : (
              <Card>
                <p className="mb-2 text-sm text-muted">
                  Set a home location to see the next {HOME_WINDOW_DAYS} days.
                </p>
                <LocationSearch
                  onSelect={(g) =>
                    store.setHomeLocation({ name: g.name, latLong: g.latLong })
                  }
                />
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Pinned dates</SectionTitle>
            <Card>
              <p className="mb-2 text-sm text-muted">
                Pin any US city + date to track it beyond the home window.
              </p>
              <PinForm />
            </Card>
            {pinEntries.length === 0 ? (
              <p className="text-sm text-muted">Nothing pinned.</p>
            ) : (
              <Card>
                <WeatherTable
                  entries={pinEntries}
                  checks={checks}
                  view={view}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(pins ?? []).map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        p.id != null && store.removeTrackedForecast(p.id)
                      }
                      className="text-xs text-muted hover:text-down"
                      title="Unpin (keeps history)"
                    >
                      unpin {p.location} · {dayLabel(p.forecastDate)}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </section>

          <p className="text-xs text-muted">
            Columns are the days you fetched. A blank cell means no check that day.
            Deltas compare each row against its own previous check; sky shows
            changed / same.
          </p>
        </>
      )}
    </div>
  );
}

function PinForm() {
  const [loc, setLoc] = useState<{
    name: string;
    latLong: [number, number];
  } | null>(null);
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!loc || !date) return;
    await store.addTrackedForecast(
      { name: loc.name, latLong: loc.latLong },
      date.replace(/-/g, ""),
    );
    setMsg(`Pinned ${loc.name} on ${date}.`);
    setDate("");
    setLoc(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {loc ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{loc.name}</span>
          <button
            className="text-xs text-muted hover:text-foreground"
            onClick={() => setLoc(null)}
          >
            change
          </button>
        </div>
      ) : (
        <LocationSearch
          onSelect={(g) => setLoc({ name: g.name, latLong: g.latLong })}
        />
      )}
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <Button variant="outline" onClick={add} disabled={!loc || !date}>
          Pin
        </Button>
      </div>
      {date && horizonNote(date.replace(/-/g, "")) && (
        <p className="text-xs text-muted">{horizonNote(date.replace(/-/g, ""))}</p>
      )}
      {msg && <p className="text-xs text-up">{msg}</p>}
    </div>
  );
}
