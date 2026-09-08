"use client";

// Phase-A autocheck: no service worker. Ticks on mount, on visibilitychange →
// visible, and every 5 min while the tab is visible. The tick core (fetch +
// diff + cross-tab Web Lock) lives in lib/autocheckTick.ts and is shared with
// the service worker; here we just fire window Notifications. See
// docs/autocheck.md.

import { useEffect, useRef } from "react";
import { AUTOCHECK_LABEL, type AutocheckCategory } from "@/lib/autocheck";
import { autocheckTick, notificationBody } from "@/lib/autocheckTick";

const TICK_MS = 5 * 60 * 1000;

const CATEGORY_PATH: Record<AutocheckCategory, string> = {
  stocks: "/stocks",
  weather: "/weather",
  custom: "/custom",
  sportsbook: "/sportsbook",
};

export function AutocheckRunner() {
  const running = useRef(false);

  useEffect(() => {
    async function tick() {
      if (running.current) return;
      running.current = true;
      try {
        const { notify, results } = await autocheckTick();
        if (notify) for (const r of results) fireNotification(r.category, r.changes);
      } catch {
        /* a bad tick shouldn't wedge the app */
      } finally {
        running.current = false;
      }
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, TICK_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  return null;
}

function fireNotification(
  category: AutocheckCategory,
  changes: Parameters<typeof notificationBody>[0],
) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  const n = new Notification(
    `${AUTOCHECK_LABEL[category]} — ${changes.length} change${
      changes.length === 1 ? "" : "s"
    }`,
    { body: notificationBody(changes), tag: `autocheck-${category}` },
  );
  n.onclick = () => {
    window.focus();
    window.location.assign(CATEGORY_PATH[category]);
    n.close();
  };
}
