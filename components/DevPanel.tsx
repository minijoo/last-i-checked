"use client";

// Dev-only. Rendered from Settings when NODE_ENV === "development".

import { useEffect, useState } from "react";
import { getDevTime, setDevTime, type DevTime } from "@/lib/devtime";
import { runStockFetch, runWeatherFetch } from "@/lib/fetchers";
import { pingServiceWorkerTick } from "@/lib/sw";
import { Button, Card, SectionTitle } from "./ui";

const DAY = 86_400_000;
const PRESETS: Array<{ label: string; ms: number }> = [
  { label: "−3d", ms: -3 * DAY },
  { label: "−2d", ms: -2 * DAY },
  { label: "−1d", ms: -1 * DAY },
  { label: "−12h", ms: -12 * 3_600_000 },
  { label: "now", ms: 0 },
];

function describe(ms: number): string {
  if (ms === 0) return "no offset (real time)";
  const past = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.round(abs / 3_600_000);
  const txt = h % 24 === 0 ? `${h / 24}d` : `${h}h`;
  return `${txt} ${past ? "in the past" : "in the future"}`;
}

export function DevPanel() {
  const [cfg, setCfg] = useState<DevTime>({ offsetMs: 0, jitter: false });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // One-time read of the persisted setting after mount (localStorage isn't
    // available during render). Not a reactive sync — this is a dev tool.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCfg(getDevTime());
  }, []);

  function apply(next: DevTime) {
    setCfg(next);
    setDevTime(next);
  }

  async function simulate() {
    setBusy(true);
    setStatus("Running 4 fetches (−3d, −2d, −1d, now) with jitter…");
    const restore = getDevTime();
    try {
      let total = 0;
      for (const off of [-3, -2, -1, 0]) {
        setDevTime({ offsetMs: off * DAY, jitter: true });
        const [s, w] = await Promise.all([runStockFetch(), runWeatherFetch()]);
        total += s.added + w.added;
      }
      setStatus(`Done — wrote ${total} checks across 4 buckets.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setDevTime(restore);
      setCfg(restore);
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Dev · fetch simulator</SectionTitle>
      <Card className="border-dashed">
        <p className="mb-3 text-xs text-muted">
          Development only — stripped from production. Shifts the timestamp the
          Fetch buttons write, so checks land in older buckets, and (with the
          box below) wobbles every fetched number — stocks, weather, custom
          checks, sportsbook — so consecutive fetches differ.
        </p>

        <div className="mb-1 text-xs font-medium text-muted">
          Timestamp offset · {describe(cfg.offsetMs)}
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant={cfg.offsetMs === p.ms ? "solid" : "outline"}
              onClick={() => apply({ ...cfg, offsetMs: p.ms })}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <label className="mb-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={cfg.jitter}
            onChange={(e) => apply({ ...cfg, jitter: e.target.checked })}
          />
          wobble every fetched number ±~2.5% per fetch
        </label>

        <div className="flex items-center gap-2">
          <Button onClick={simulate} disabled={busy}>
            {busy ? "Simulating…" : "Simulate 4 days of checks"}
          </Button>
          <span className="text-xs text-muted">
            fetches at −3d / −2d / −1d / now, jitter on, then restores settings
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await pingServiceWorkerTick();
              setStatus(
                ok
                  ? "Pinged the service worker — check for a background autocheck."
                  : "No active service worker yet (reload once).",
              );
            }}
          >
            Run background tick
          </Button>
          <span className="text-xs text-muted">
            asks the SW to run an autocheck tick now (real periodicSync only fires
            for an installed PWA)
          </span>
        </div>
        {status && <p className="mt-2 text-xs text-up">{status}</p>}
      </Card>
    </section>
  );
}
