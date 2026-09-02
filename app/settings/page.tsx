"use client";

import { useRef, useState } from "react";
import { DevPanel } from "@/components/DevPanel";
import { LocationSearch } from "@/components/LocationSearch";
import { Button, Card, SectionTitle } from "@/components/ui";
import { useHomeLocation } from "@/lib/hooks";
import { store } from "@/lib/store";
import type { BackupBlob } from "@/lib/types";

export default function SettingsPage() {
  const home = useHomeLocation();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="flex flex-col gap-2">
        <SectionTitle>Home location</SectionTitle>
        <Card>
          <p className="mb-2 text-sm">
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
              className="mt-2 text-xs text-muted hover:text-down"
            >
              clear
            </button>
          )}
        </Card>
      </section>

      <BackupSection />

      {process.env.NODE_ENV === "development" && <DevPanel />}
    </div>
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
