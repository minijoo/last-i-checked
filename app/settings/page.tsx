"use client";

import { useRef, useState } from "react";
import { DevPanel } from "@/components/DevPanel";
import { LocationSearch } from "@/components/LocationSearch";
import { Button, Card, Input, SectionTitle } from "@/components/ui";
import { IS_DEV } from "@/lib/devtime";
import { useHomeLocation, useSportsbookAccess, useTempUnit } from "@/lib/hooks";
import { setUserOddsKey } from "@/lib/sportsbookCredits";
import { store } from "@/lib/store";
import type { BackupBlob } from "@/lib/types";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <WeatherSection />

      <SportsbookSection />

      <BackupSection />

      {IS_DEV && <DevPanel />}
    </div>
  );
}

function WeatherSection() {
  const home = useHomeLocation();
  const tempUnit = useTempUnit();

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Weather</SectionTitle>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Home location</span>
          <p className="text-sm">
            {home === undefined
              ? "Loading…"
              : home
                ? `Current: ${home.name}`
                : "Not set."}
          </p>
          <LocationSearch
            onSelect={(g) =>
              store.setHomeLocation({ name: g.name, latLong: g.latLong })
            }
            placeholder="Set home location…"
          />
          {home && (
            <button
              onClick={() => store.setSetting("homeLocation", null)}
              className="self-start text-xs text-muted hover:text-down"
            >
              clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Temperature unit</span>
          <div className="flex gap-1">
            {(["F", "C"] as const).map((u) => (
              <Button
                key={u}
                variant={tempUnit === u ? "solid" : "outline"}
                onClick={() => store.setSetting("tempUnit", u)}
              >
                °{u}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted">
            Display only — forecasts are always fetched and stored in °F. In °C,
            temperature values and deltas show to one decimal place, and the
            difference is calculated after converting.
          </p>
        </div>
      </Card>
    </section>
  );
}

function SportsbookSection() {
  const access = useSportsbookAccess();
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    await setUserOddsKey(value.trim());
    setValue("");
    setMsg(value.trim() ? "Saved. Your key is now used for all Odds API calls." : "Key cleared.");
  }

  async function clearKey() {
    await setUserOddsKey("");
    setValue("");
    setMsg("Key cleared. Back to trial credits.");
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Sportsbook</SectionTitle>
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          The Sportsbook page uses{" "}
          <a
            href="https://the-odds-api.com/#get-access"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            The Odds API
          </a>
          . Each time you load or refresh a line costs one credit. This app gives
          you {access?.trialLimit ?? 7} free trial credits per calendar month
          against a shared key; add your own key for unlimited use.
        </p>

        {access && (
          <p className="text-sm">
            {access.userKey ? (
              <>
                Using <span className="font-medium">your own key</span> (ending
                &hellip;{access.userKey.slice(-4)}). Trial limit no longer applies.
              </>
            ) : (
              <>
                Trial credits used this month:{" "}
                <span className="font-medium">
                  {access.trialUsed} / {access.trialLimit}
                </span>
                . This count resets on the 1st of each month, or if you clear this
                browser&apos;s data.
              </>
            )}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Your Odds API key</label>
          <div className="flex flex-wrap gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="paste key here"
              spellCheck={false}
              className="w-72 font-mono"
            />
            <Button variant="outline" onClick={save} disabled={!value.trim()}>
              Save
            </Button>
            {access?.userKey && (
              <Button variant="ghost" onClick={clearKey}>
                Remove key
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            Get one free at{" "}
            <a
              href="https://the-odds-api.com/#get-access"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              the-odds-api.com/#get-access
            </a>{" "}
            — pick the free tier (no card, 500 credits/month). Stored only in this
            browser.
          </p>
        </div>

        {msg && <p className="text-xs text-up">{msg}</p>}
      </Card>
    </section>
  );
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  async function exportJson() {
    setErr(null);
    setMsg(null);
    const blob = await store.exportAll();
    const text = JSON.stringify(blob, null, 2);
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `last-i-checked-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const counts =
      `${blob.stockChecks.length} stock + ${blob.weatherChecks.length} weather checks, ` +
      `${blob.trackedStocks.length} + ${blob.trackedForecasts.length} tracked`;
    setMsg(`Exported ${counts}.`);
  }

  async function importJson(file: File) {
    setErr(null);
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text()) as BackupBlob;
      await store.importAll(parsed, mode);
      setMsg(
        `Imported (${mode}). ${parsed.stockChecks?.length ?? 0} stock + ${
          parsed.weatherChecks?.length ?? 0
        } weather checks.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Backup</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-muted">
          v1 keeps everything in this browser only. Clearing site data wipes it —
          export a JSON file to keep a copy.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportJson}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <label className="ml-2 flex items-center gap-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={mode === "replace"}
              onChange={(e) => setMode(e.target.checked ? "replace" : "merge")}
            />
            replace existing
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
            }}
          />
        </div>
        {msg && <p className="mt-2 text-xs text-up">{msg}</p>}
        {err && <p className="mt-2 text-xs text-down">{err}</p>}
      </Card>
    </section>
  );
}
