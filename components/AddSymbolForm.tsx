"use client";

import { useState } from "react";
import { lookupSymbol } from "@/lib/actions/stocks";
import { store } from "@/lib/store";
import { Button, Input } from "./ui";

export function AddSymbolForm() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = value.trim().toUpperCase();
    if (!s) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await lookupSymbol(s);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await store.addTrackedStock(res.info.symbol);
      setOk(`Added ${res.info.symbol} — ${res.info.name}`);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add symbol.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a ticker, e.g. AAPL"
          className="w-48"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "…" : "Add"}
        </Button>
      </div>
      {ok && <p className="text-xs text-up">{ok}</p>}
      {error && <p className="text-xs text-down">{error}</p>}
    </form>
  );
}
