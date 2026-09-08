"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/sw";

/** Registers /sw.js on load. The SW runs background autochecks where the browser
 *  allows it (see docs/autocheck.md, Phase B); it's harmless otherwise. */
export function ServiceWorker() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
