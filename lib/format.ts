// Small formatting helpers shared across the UI.

export function formatPrice(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Signed delta, e.g. "+3.10", "-0.42", "0.00". */
export function formatDelta(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}`;
}

export function formatTemp(n: number, unit: string): string {
  return `${Math.round(n)}°${unit}`;
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

/** "Sep 1" — date only. */
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
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
