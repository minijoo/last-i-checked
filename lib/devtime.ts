// Dev test aid. Lets the "Fetch" buttons write checks into older buckets and
// wobble the numbers, so the delta-column path can be exercised without waiting
// for real days/forecast changes to pass. Active in local dev, on Vercel
// preview deployments, and when NEXT_PUBLIC_DEV_TOOLS=1 — inert in real
// production. Every accessor short-circuits unless DEV.

const KEY = "lic:devtime";
const DEV =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
  process.env.NEXT_PUBLIC_DEV_TOOLS === "1";

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

/** Optionally wobble a fetched number so back-to-back dev fetches differ.
 *  Rounds to 2 dp — fine for prices, temps, wind, rain-mm, betting lines. */
export function jitterValue(n: number): number {
  if (!getDevTime().jitter) return n;
  return Math.round(n * (1 + (Math.random() - 0.5) * 0.05) * 100) / 100;
}

/** Like jitterValue but keeps 5 dp, so fine-grained custom-check values
 *  (batting average, win %) still produce a visible delta when wobbled. */
export function jitterCustom(n: number): number {
  if (!getDevTime().jitter) return n;
  return Math.round(n * (1 + (Math.random() - 0.5) * 0.05) * 1e5) / 1e5;
}

/** Like jitterValue but for American odds: wobble the magnitude by a few
 *  integer points, keep the sign, and never cross ±100. */
export function jitterOdds(price: number): number {
  if (!getDevTime().jitter) return price;
  const sign = price < 0 ? -1 : 1;
  const mag = Math.max(
    101,
    Math.abs(price) + Math.round((Math.random() - 0.5) * 30),
  );
  return sign * mag;
}

export const IS_DEV = DEV;
