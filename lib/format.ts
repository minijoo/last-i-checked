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

// ---- Weather dateStr helpers: "YYYYMMDD.X" (X = 0 day, 1 night) ----

export function makeDateStr(date: Date, isNight: boolean): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}.${isNight ? 1 : 0}`;
}

/** "YYYYMMDD" calendar-date key (no day/night suffix) for a Date. */
export function calendarKey(date: Date): string {
  return makeDateStr(date, false).slice(0, 8);
}

export function parseCalendarKey(key: string): Date {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  const d = Number(key.slice(6, 8));
  return new Date(y, m - 1, d);
}

/** Pretty-print a "YYYYMMDD.X" dateStr, e.g. "Mon Sep 1 · day". */
export function formatDateStr(dateStr: string): string {
  const [ymd, half] = dateStr.split(".");
  const date = parseCalendarKey(ymd);
  const label = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${label} · ${half === "1" ? "night" : "day"}`;
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
