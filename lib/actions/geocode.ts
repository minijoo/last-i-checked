"use server";

// Location search. GeoNames is the documented source (docs/plan.md); it needs a
// free username in GEONAMES_USERNAME. When that isn't set we fall back to
// Open-Meteo's keyless geocoding API so search works out of the box in dev.
// Either way results are filtered to the US, since NWS is US-only.

import type { GeoResult, Result } from "@/lib/types";

export async function searchLocations(
  query: string,
): Promise<Result<{ results: GeoResult[] }>> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, results: [] };

  const username = process.env.GEONAMES_USERNAME;
  try {
    const results = username
      ? await viaGeoNames(q, username)
      : await viaOpenMeteo(q);
    return { ok: true, results };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Location search failed",
    };
  }
}

async function viaGeoNames(q: string, username: string): Promise<GeoResult[]> {
  const url =
    `https://secure.geonames.org/searchJSON?name_startsWith=${encodeURIComponent(q)}` +
    `&featureClass=P&maxRows=12&country=US&orderby=population&username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error(`GeoNames responded ${res.status}`);
  const json = (await res.json()) as {
    status?: { message: string };
    geonames?: Array<{
      name: string;
      adminName1?: string;
      countryCode?: string;
      lat: string;
      lng: string;
    }>;
  };
  if (json.status) throw new Error(`GeoNames: ${json.status.message}`);
  return (json.geonames ?? [])
    .filter((g) => g.countryCode === "US")
    .map((g) => ({
      name: g.adminName1 ? `${g.name}, ${g.adminName1}` : g.name,
      latLong: [Number(g.lat), Number(g.lng)] as [number, number],
      country: "US",
    }));
}

async function viaOpenMeteo(q: string): Promise<GeoResult[]> {
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
    `&count=12&language=en&format=json`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const json = (await res.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
    }>;
  };
  return (json.results ?? [])
    .filter((r) => r.country_code === "US")
    .map((r) => ({
      name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
      latLong: [r.latitude, r.longitude] as [number, number],
      country: "US",
    }));
}
