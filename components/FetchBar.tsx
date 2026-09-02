"use client";

import { useState } from "react";
import type { FetchOutcome } from "@/lib/fetchers";
import { Button } from "./ui";

export function FetchBar({
  onFetch,
  label = "Fetch now",
}: {
  onFetch: () => Promise<FetchOutcome>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function go() {
    setBusy(true);
    setMsg(null);
    setErrors([]);
    try {
      const r = await onFetch();
      setErrors(r.errors);
      if (r.added > 0) {
        setMsg(
          `Recorded ${r.added} check${r.added === 1 ? "" : "s"} at ${new Date().toLocaleTimeString()}.`,
        );
      } else if (r.errors.length === 0) {
        setMsg("Nothing to fetch — add something to track first.");
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Fetch failed."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button onClick={go} disabled={busy} className="self-start">
        {busy ? "Fetching…" : label}
      </Button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-down">
          {e}
        </p>
      ))}
    </div>
  );
}
