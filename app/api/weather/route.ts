// Weather for the Fetch button and autocheck (incl. the service worker).
// GET ?lat=&lon=            → 10-day timeline
// POST { lat, lon, dates }  → day summaries for dates beyond the timeline window
// Keeps OPENWEATHER_API_KEY server-side.

import { fetchDaySummaries, fetchTimeline } from "@/lib/providers/weather";

export const runtime = "nodejs";

const NO_KEY =
  "OPENWEATHER_API_KEY not set. Add it to .env.local and restart the dev server.";

export async function GET(request: Request): Promise<Response> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return Response.json({ ok: false, error: NO_KEY });
  const sp = new URL(request.url).searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ ok: false, error: "Missing lat/lon." });
  }
  return Response.json(await fetchTimeline(lat, lon, key));
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return Response.json({ results: [{ ok: false, error: NO_KEY }] });
  let body: {
    lat?: number;
    lon?: number;
    dates?: Array<{ isoDate: string; source: "forecast" | "summary" }>;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ results: [] });
  }
  const { lat, lon, dates } = body;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Array.isArray(dates)
  ) {
    return Response.json({ results: [] });
  }
  return Response.json({
    results: await fetchDaySummaries(lat as number, lon as number, dates, key),
  });
}
