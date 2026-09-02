"use client";

import { useState } from "react";
import { FetchBar } from "@/components/FetchBar";
import { LocationSearch } from "@/components/LocationSearch";
import { WeatherCard } from "@/components/WeatherCard";
import { Button, Card, SectionTitle } from "@/components/ui";
import { HOME_WINDOW_DAYS, runWeatherFetch } from "@/lib/fetchers";
import { todayCalendarKeys } from "@/lib/format";
import {
  useAllWeatherChecks,
  useHomeLocation,
  useTrackedForecasts,
} from "@/lib/hooks";
import { store } from "@/lib/store";
import { VIEW_LABELS, type WeatherView } from "@/lib/weather-view";

export default function WeatherPage() {
  const home = useHomeLocation();
  const pins = useTrackedForecasts();
  const checks = useAllWeatherChecks();
  const [view, setView] = useState<WeatherView>("temp");

  const loading =
    home === undefined || pins === undefined || checks === undefined;
  const windowKeys = todayCalendarKeys(HOME_WINDOW_DAYS);

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
              <>
                {windowKeys.map((k) => (
                  <WeatherCard
                    key={k}
                    location={home.name}
                    calKey={k}
                    view={view}
                    checks={checks}
                  />
                ))}
              </>
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
            {pins.length === 0 ? (
              <p className="text-sm text-muted">Nothing pinned.</p>
            ) : (
              pins.map((p) => (
                <WeatherCard
                  key={p.id}
                  location={p.location}
                  calKey={p.forecastDate}
                  view={view}
                  checks={checks}
                  pinned
                  onUnpin={() => p.id != null && store.removeTrackedForecast(p.id)}
                />
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PinForm() {
  const [loc, setLoc] = useState<{ name: string; latLong: [number, number] } | null>(
    null,
  );
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!loc || !date) return;
    const calKey = date.replace(/-/g, "");
    await store.addTrackedForecast(
      { name: loc.name, latLong: loc.latLong },
      calKey,
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
      {msg && <p className="text-xs text-up">{msg}</p>}
    </div>
  );
}
