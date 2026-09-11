// Small formatting helpers shared across the UI.

export function formatPrice(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Signed delta, e.g. "+3.10", "-0.42", "0.00". With `trim`, `digits` is a cap
 *  and trailing zeros are dropped: "+3.1", "-0.005", "+42". */
export function formatDelta(n: number, digits = 2, trim = false): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const mag = trim
    ? String(Number(Math.abs(n).toFixed(digits)))
    : Math.abs(n).toFixed(digits);
  return `${sign}${mag}`;
}

export function formatTemp(n: number, unit: string): string {
  return `${Math.round(n)}°${unit}`;
}

/** Percent change from a baseline, given the arithmetic `delta` and the current
 *  `value` (so the baseline is `value - delta`): `(delta / base) * 100`.
 *  Returns null when there's no baseline (`delta === null`) or the baseline is
 *  0 (which would be ±Infinity) — callers render that as "—". */
export function pctChange(delta: number | null, value: number): number | null {
  if (delta === null) return null;
  const base = value - delta;
  return base === 0 ? null : (delta / base) * 100;
}

/** °F → °C. Weather is always fetched/stored in °F; Celsius is a display choice. */
export function fToC(f: number): number {
  return (f - 32) * (5 / 9);
}

/** OpenWeather returns precipitation in mm; the app shows inches. */
export function mmToInches(mm: number): number {
  return mm / 25.4;
}

export function formatRain(mm: number): string {
  return `${mmToInches(mm).toFixed(2)}"`;
}

/** "Sep 1, 2:14 PM" — absolute timestamp for tooltips / "as of" lines. */
export function formatStamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "10:51PM" — compact time of day, for the column-header sub-line. */
export function formatClock(ts: number): string {
  return new Date(ts)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s+/g, "");
}

/** "Sep 1" — date only. */
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * "2 hours ago" / "yesterday" / "3 days ago" / "Sep 1, 2026" — relative for
 * anything within the last 7 days (with sub-day granularity for today),
 * absolute once it's older than that. Used for the About page changelog.
 */
export function formatRelativeDate(ts: number, now: number = Date.now()): string {
  const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayDiff = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);

  if (dayDiff <= 0) {
    const minutes = Math.round((now - ts) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (dayDiff === 1) return "yesterday";
  if (dayDiff <= 7) return `${dayDiff} days ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Relative day header for a bucket key ("YYYY-MM-DD", optionally with an
 * "-AM"/"-PM" half that we ignore): "today", "1 day ago", "3 days ago".
 */
export function relativeDayLabel(key: string): string {
  const [y, m, d] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  return days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---- Weather date helpers: "YYYYMMDD" calendar-date keys ----

/** "YYYYMMDD" calendar-date key for a Date, in that Date's local components. */
export function calendarKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function parseCalendarKey(key: string): Date {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  const d = Number(key.slice(6, 8));
  return new Date(y, m - 1, d);
}

/** "YYYYMMDD" -> "YYYY-MM-DD" (the format OpenWeather day_summary wants). */
export function calKeyToIso(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

/**
 * "YYYYMMDD" from a Unix-seconds timestamp, read in UTC. OpenWeather's
 * timeline/1day stamps each day at 00:00 UTC and the date part is the forecast
 * date for that location regardless of the request point.
 */
export function calendarKeyFromUnixUTC(dtSeconds: number): string {
  const d = new Date(dtSeconds * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function todayCalendarKeys(count: number): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(calendarKey(d));
  }
  return out;
}
