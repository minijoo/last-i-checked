"use server";

// Location search via OpenWeather's geocoding API. Global — any city.
// See docs/plan.md "External Data-Sources".

import type { GeoResult, Result } from "@/lib/types";

export async function searchLocations(
  query: string,
): Promise<Result<{ results: GeoResult[] }>> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, results: [] };

  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "OPENWEATHER_API_KEY not set. Add it to .env.local and restart.",
    };
  }

  const url =
    `https://api.openweathermap.org/geo/1.0/direct` +
    `?q=${encodeURIComponent(q)}&limit=10&appid=${key}`;
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) {
      return { ok: false, error: `OpenWeather responded ${res.status}` };
    }
    const json = (await res.json()) as Array<{
      name: string;
      state?: string;
      country: string;
      lat: number;
      lon: number;
    }>;
    const results: GeoResult[] = json.map((g) => ({
      name: [g.name, g.state, g.country].filter(Boolean).join(", "),
      latLong: [g.lat, g.lon] as [number, number],
      country: g.country,
    }));
    return { ok: true, results };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Location search failed",
    };
  }
}
