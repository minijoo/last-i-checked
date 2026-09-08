// Client-side service-worker helpers. The SW itself (public/sw.js, built from
// sw/index.ts) does the background autocheck; here we register it and manage the
// Periodic Background Sync tag. See docs/autocheck.md, Phase B.

const SW_URL = "/sw.js";
const PSYNC_TAG = "autocheck";
const PSYNC_MIN_INTERVAL = 4 * 60 * 60 * 1000; // 4h floor; the browser clamps up

type PeriodicSyncManager = {
  register(tag: string, opts: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
};

function hasSW(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!hasSW()) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL);
  } catch {
    return null;
  }
}

/**
 * Register or unregister the periodic-background-sync tag. A no-op unless the
 * browser supports it AND the permission is already granted (Chromium + installed
 * PWA + engaged) — Phase A's check-on-open covers everything else.
 */
export async function syncPeriodicBackground(enabled: boolean): Promise<void> {
  const reg = await registerServiceWorker();
  if (!reg || !("periodicSync" in reg)) return;
  const psync = (reg as unknown as { periodicSync: PeriodicSyncManager })
    .periodicSync;

  if (!enabled) {
    try {
      await psync.unregister(PSYNC_TAG);
    } catch {
      /* not registered */
    }
    return;
  }
  try {
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    });
    if (status.state === "granted") {
      await psync.register(PSYNC_TAG, { minInterval: PSYNC_MIN_INTERVAL });
    }
  } catch {
    /* unsupported */
  }
}

/** Ask the SW to run an autocheck tick now (used as a dev trigger, and right
 *  after enabling so the user doesn't wait for the first scheduled time). */
export async function pingServiceWorkerTick(): Promise<boolean> {
  const reg = await registerServiceWorker();
  const target = reg?.active ?? navigator.serviceWorker?.controller ?? null;
  if (!target) return false;
  target.postMessage({ type: "autocheck-tick" });
  return true;
}
