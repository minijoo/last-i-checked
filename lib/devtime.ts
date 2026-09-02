// Dev-only test aid. Lets the "Fetch" buttons write checks into older buckets
// and wobble the numbers, so the delta-column path can be exercised without
// waiting for real days/forecast changes to pass. Inert in production builds:
// every accessor short-circuits unless NODE_ENV === "development".

const KEY = "lic:devtime";
const DEV = process.env.NODE_ENV === "development";

export interface DevTime {
  offsetMs: number; // added to Date.now() when stamping a check
  jitter: boolean; // wobble price/temp by a few % per fetch
}

const OFF: DevTime = { offsetMs: 0, jitter: false };

export function getDevTime(): DevTime {
  if (!DEV || typeof localStorage === "undefined") return OFF;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return OFF;
    const p = JSON.parse(raw) as Partial<DevTime>;
    return { offsetMs: Number(p.offsetMs) || 0, jitter: Boolean(p.jitter) };
  } catch {
    return OFF;
  }
}

export function setDevTime(v: DevTime): void {
  if (!DEV || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Timestamp to stamp on a check being written now. */
export function nowForCheck(): number {
  return Date.now() + getDevTime().offsetMs;
}

/** Optionally wobble a fetched number so back-to-back dev fetches differ. */
export function jitterValue(n: number): number {
  if (!getDevTime().jitter) return n;
  return Math.round(n * (1 + (Math.random() - 0.5) * 0.05) * 100) / 100;
}

export const IS_DEV = DEV;
