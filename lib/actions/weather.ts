"use server";

// National Weather Service proxy. NWS needs no key but requires a User-Agent.
// Two-step: /points/{lat},{lon} -> grid forecast URL -> /forecast.
// The grid mapping is static per point, so callers cache the returned gridUrl.
// See docs/plan.md "External Data-Sources".

import type { ForecastPeriod, Result } from "@/lib/types";

const UA =
  process.env.NWS_USER_AGENT ??
  "last-i-checked/0.1 (local development; set NWS_USER_AGENT)";

function nwsHeaders() {
  return { "User-Agent": UA, Accept: "application/geo+json" };
}

export async function resolveGridUrl(
  lat: number,
  lon: number,
): Promise<Result<{ gridUrl: string }>> {
  try {
    const res = await fetch(
      `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: nwsHeaders(), next: { revalidate: 60 * 60 * 24 * 30 } },
    );
    if (res.status === 404) {
      return {
        ok: false,
        error: "NWS has no forecast for this location (US and territories only).",
      };
    }
    if (!res.ok) {
      return { ok: false, error: `NWS responded ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as { properties?: { forecast?: string } };
    const gridUrl = json.properties?.forecast;
    if (!gridUrl) {
      return { ok: false, error: "NWS did not return a forecast URL for this point." };
    }
    return { ok: true, gridUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting NWS",
    };
  }
}

/** Full 7-day forecast, normalized. Pass a cached gridUrl to skip the /points call. */
export async function fetchForecast(
  latLong: [number, number],
  knownGridUrl?: string,
): Promise<Result<{ gridUrl: string; periods: ForecastPeriod[] }>> {
  let gridUrl = knownGridUrl?.trim() || "";
  if (!gridUrl) {
    const r = await resolveGridUrl(latLong[0], latLong[1]);
    if (!r.ok) return r;
    gridUrl = r.gridUrl;
  }

  try {
    const res = await fetch(gridUrl, {
      headers: nwsHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `NWS responded ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as {
      properties?: { periods?: RawPeriod[] };
    };
    const raw = json.properties?.periods ?? [];
    const periods: ForecastPeriod[] = raw.map((p) => {
      // startTime carries the location's UTC offset; take the local calendar date
      // straight from the ISO string rather than the server's clock.
      const calKey = p.startTime.slice(0, 10).replace(/-/g, "");
      const isNight = !p.isDaytime;
      return {
        calKey,
        isNight,
        dateStr: `${calKey}.${isNight ? 1 : 0}`,
        name: p.name,
        temp: p.temperature,
        tempUnit: p.temperatureUnit,
        rainProb:
          typeof p.probabilityOfPrecipitation?.value === "number"
            ? p.probabilityOfPrecipitation.value
            : 0,
        skyCond: p.shortForecast,
      };
    });
    return { ok: true, gridUrl, periods };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error contacting NWS",
    };
  }
}

interface RawPeriod {
  name: string;
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  probabilityOfPrecipitation?: { value: number | null };
  shortForecast: string;
}
