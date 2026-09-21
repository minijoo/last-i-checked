"use client";

import { useState } from "react";
import type { FetchOutcome } from "@/lib/fetchers";
import { Button } from "./ui";

export interface FetchNote {
  msg: string | null;
  errors: string[];
}

/**
 * Fetch button + result messages. By default the messages render under the
 * button. Pass `onResult` to receive them instead (called with an empty note when
 * a fetch starts) and render them elsewhere — for a bar that sits in a table
 * cell, where a long message would widen the column.
 */
export function FetchBar({
  onFetch,
  label = "Fetch now",
  onResult,
}: {
  onFetch: () => Promise<FetchOutcome>;
  label?: string;
  onResult?: (note: FetchNote) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function report(note: FetchNote) {
    if (onResult) onResult(note);
    else {
      setMsg(note.msg);
      setErrors(note.errors);
    }
  }

  async function go() {
    setBusy(true);
    report({ msg: null, errors: [] });
    try {
      const r = await onFetch();
      report({
        errors: r.errors,
        msg:
          r.added > 0
            ? `Recorded ${r.added} check${r.added === 1 ? "" : "s"} at ${new Date().toLocaleTimeString()}.`
            : r.errors.length === 0
              ? "Nothing to fetch — add something to track first."
              : null,
      });
    } catch (e) {
      report({ msg: null, errors: [e instanceof Error ? e.message : "Fetch failed."] });
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
