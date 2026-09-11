"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Drawer } from "@/components/Drawer";
import { FetchBar } from "@/components/FetchBar";
import { LocationSearch } from "@/components/LocationSearch";
import { MatrixFrame } from "@/components/MatrixFrame";
import { Button, Card, SectionTitle } from "@/components/ui";
import {
  type WeatherLane,
  WeatherMatrix,
  type WeatherRow,
} from "@/components/WeatherMatrix";
import { HOME_WINDOW_DAYS, runWeatherFetch } from "@/lib/fetchers";
import { parseCalendarKey, todayCalendarKeys } from "@/lib/format";
import {
  useAllWeatherChecks,
  useDeltaMode,
  useHomeLocation,
  useTempUnit,
  useTrackedForecasts,
} from "@/lib/hooks";
import { store } from "@/lib/store";
import type { WeatherCheck } from "@/lib/types";
import { fmtRainInches, fmtTemp, fmtWindMph, numColumnsFor } from "@/lib/weather-view";

/** Home-table views. "temp" folds day + night into one table as AM/PM lanes. */
const HOME_VIEWS = { temp: "Temp", rain: "Rain/Wind" } as const;
type HomeView = keyof typeof HOME_VIEWS;

interface Entry {
  location: string;
  calKey: string;
}

const MS_DAY = 86_400_000;

/** Row-header date, split across two lines: "Sep 11" over a short weekday. */
function rowDate(calKey: string): { md: string; wd: string } {
  const d = parseCalendarKey(calKey);
  return {
    md: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    wd: d.toLocaleDateString(undefined, { weekday: "short" }),
  };
}

/** Note for a pinned date the standard forecast won't cover. */
function horizonNote(calKey: string): string | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (parseCalendarKey(calKey).getTime() - today.getTime()) / MS_DAY,
  );
  if (days < 0) return "past date — no data is fetched; unpin when done";
  if (days >= HOME_WINDOW_DAYS)
    return `${days} days out — estimated (OpenWeather day summary)`;
  return undefined;
}

function WeatherTable({
  entries,
  checks,
  view,
}: {
  entries: Entry[];
  checks: WeatherCheck[];
  view: HomeView;
}) {
  const tempUnit = useTempUnit();
  const tempDigits = tempUnit === "C" ? 1 : 0;
  const asPercent = useDeltaMode("weather") === "pct";

  const rows = useMemo<WeatherRow[]>(() => {
    return entries.map((e) => {
      const { md, wd } = rowDate(e.calKey);
      const subset = checks.filter(
        (c) => c.location === e.location && c.dateStr === e.calKey,
      );
      const lanes: WeatherLane[] =
        view === "rain"
          ? [
              {
                key: "rain",
                label: "Rain",
                columns: numColumnsFor(subset, "rain"),
                format: fmtRainInches,
                digits: 2,
              },
              {
                key: "wind",
                label: (
                  <>
                    Wind
                    <br />
                    Speed
                  </>
                ),
                columns: numColumnsFor(subset, "wind"),
                format: fmtWindMph,
                digits: 0,
              },
            ]
          : [
              {
                key: "day",
                label: "AM",
                columns: numColumnsFor(subset, "day", tempUnit),
              },
              {
                key: "night",
                label: "PM",
                columns: numColumnsFor(subset, "night", tempUnit),
              },
            ];
      return {
        id: `${e.location}-${e.calKey}`,
        label: (
          <Link
            href={`/weather/day?loc=${encodeURIComponent(e.location)}&date=${e.calKey}`}
            className="flex flex-col leading-tight hover:underline"
          >
            <span>{md}</span>
            <span className="text-xs font-normal text-muted">{wd}</span>
          </Link>
        ),
        lanes,
      };
    });
  }, [entries, checks, view, tempUnit]);

  return (
    <MatrixFrame page="weather">
      <WeatherMatrix
        rows={rows}
        format={view === "rain" ? fmtRainInches : fmtTemp(tempUnit)}
        digits={view === "rain" ? 2 : tempDigits}
        percent={asPercent}
      />
    </MatrixFrame>
  );
}

export default function WeatherPage() {
  const home = useHomeLocation();
  const pins = useTrackedForecasts();
  const checks = useAllWeatherChecks();
  const [view, setView] = useState<HomeView>("temp");
  const [pinOpen, setPinOpen] = useState(false);

  const loading =
    home === undefined || pins === undefined || checks === undefined;
  const windowKeys = todayCalendarKeys(HOME_WINDOW_DAYS);

  const homeEntries: Entry[] = home
    ? windowKeys.map((k) => ({ location: home.name, calKey: k }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Weather</h1>
          <p className="mt-1 text-sm text-muted">
            How the forecast has shifted since you last checked.
          </p>
        </div>
        <FetchBar onFetch={runWeatherFetch} label="Fetch forecasts" />
      </div>

      <div className="flex gap-1">
        {(Object.keys(HOME_VIEWS) as HomeView[]).map((v) => (
          <Button
            key={v}
            variant={view === v ? "solid" : "outline"}
            onClick={() => setView(v)}
          >
            {HOME_VIEWS[v]}
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
            <div className="flex items-center justify-between gap-4">
              <SectionTitle>Pinned dates</SectionTitle>
              <Button variant="outline" onClick={() => setPinOpen(true)}>
                Pin a Date
              </Button>
            </div>
            <Drawer open={pinOpen} onOpenChange={setPinOpen} title="Pin a Date">
              <p className="mb-2 text-sm text-muted">
                Pin any city + date to track it beyond the {HOME_WINDOW_DAYS}-day
                home window.
              </p>
              <PinForm onPinned={() => setPinOpen(false)} />
            </Drawer>
            {(pins ?? []).length === 0 ? (
              <p className="text-sm text-muted">Nothing pinned.</p>
            ) : (
              (pins ?? []).map((p) => {
                const note = horizonNote(p.forecastDate);
                return (
                  <Card key={p.id ?? `${p.location}-${p.forecastDate}`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <h3 className="text-sm font-semibold">{p.location}</h3>
                        {note && (
                          <span className="mt-0.5 text-xs text-muted">
                            {note}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          p.id != null && store.removeTrackedForecast(p.id)
                        }
                        className="shrink-0 text-xs text-muted hover:text-down"
                        title="Unpin (keeps history)"
                      >
                        unpin
                      </button>
                    </div>
                    <WeatherTable
                      entries={[
                        { location: p.location, calKey: p.forecastDate },
                      ]}
                      checks={checks}
                      view={view}
                    />
                  </Card>
                );
              })
            )}
          </section>

          <p className="text-xs text-muted">
            Columns are the days you fetched. A blank cell means no check that day.
            Deltas compare each row against its own previous check.
          </p>
        </>
      )}
    </div>
  );
}

function PinForm({ onPinned }: { onPinned?: () => void } = {}) {
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
    onPinned?.();
  }

  const dateNote = date ? horizonNote(date.replace(/-/g, "")) : undefined;

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
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
      />
      {dateNote && <p className="text-xs text-muted">{dateNote}</p>}
      {msg && <p className="text-xs text-up">{msg}</p>}

      {/* The main action — centered and filled, on its own row, so it stands
       *  out (same treatment as Add Custom Check / Track selected). */}
      <div className="mt-2 flex justify-center border-t border-border pt-3">
        <Button onClick={add} className="px-8" disabled={!loc || !date}>
          Pin
        </Button>
      </div>
    </div>
  );
}
