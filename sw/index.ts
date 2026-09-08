/// <reference lib="webworker" />

// Autocheck service worker (Phase B). Bundled by scripts/build-sw.mjs → public/sw.js.
// Reuses the exact tick core from lib/autocheckTick.ts (fetch via route handlers,
// IndexedDB via Dexie, change diff) and fires notifications with
// registration.showNotification. See docs/autocheck.md.

import { AUTOCHECK_LABEL, type AutocheckCategory } from "../lib/autocheck.ts";
import { autocheckTick, notificationBody } from "../lib/autocheckTick.ts";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CATEGORY_PATH: Record<AutocheckCategory, string> = {
  stocks: "/stocks",
  weather: "/weather",
  custom: "/custom",
  sportsbook: "/sportsbook",
};

sw.addEventListener("install", () => {
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});

// Best-effort background wake-up (Chromium + installed PWA + granted permission).
sw.addEventListener("periodicsync", (event) => {
  const e = event as ExtendableEvent & { tag?: string };
  if (e.tag === "autocheck") e.waitUntil(runAndNotify());
});

// Dev / "just enabled" trigger: postMessage({ type: "autocheck-tick" }).
sw.addEventListener("message", (event) => {
  const e = event as ExtendableMessageEvent;
  if (e.data?.type === "autocheck-tick") e.waitUntil(runAndNotify());
});

// Focus an existing tab (or open one) at the category page.
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path =
    (event.notification.data as { path?: string } | undefined)?.path ?? "/stocks";
  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((cs) => {
        for (const c of cs) {
          if ("focus" in c) {
            void (c as WindowClient).navigate(path);
            return (c as WindowClient).focus();
          }
        }
        return sw.clients.openWindow(path);
      }),
  );
});

async function runAndNotify(): Promise<void> {
  const { notify, results } = await autocheckTick();
  const canNotify =
    notify &&
    typeof self.Notification !== "undefined" &&
    self.Notification.permission === "granted";
  if (!canNotify) return;
  for (const { category, changes } of results) {
    try {
      await sw.registration.showNotification(
        `${AUTOCHECK_LABEL[category]} — ${changes.length} change${
          changes.length === 1 ? "" : "s"
        }`,
        {
          body: notificationBody(changes),
          tag: `autocheck-${category}`,
          data: { path: CATEGORY_PATH[category] },
        },
      );
    } catch {
      /* notifications may be blocked — the tab badge still updated */
    }
  }
}
