// Tombstone. The autocheck service worker was removed; this file exists only to
// retire the old one from browsers that registered it. A 404 on the SW script
// does NOT unregister an installed worker (the spec treats it as a soft update
// failure), so we ship a worker whose whole job is to unregister itself, drop
// any Periodic Background Sync registration, and reload open tabs so they run
// with no controller. Safe to delete once enough time has passed that no active
// installs remain.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if ("periodicSync" in self.registration) {
          await self.registration.periodicSync.unregister("autocheck");
        }
      } catch {
        /* not supported / not registered — nothing to do */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
