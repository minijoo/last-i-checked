"use client";

import { useEffect, useRef, useState } from "react";
import { searchLocations } from "@/lib/actions/geocode";
import type { GeoResult } from "@/lib/types";
import { Input } from "./ui";

/** Debounced US-city autocomplete backed by the geocode server action. */
export function LocationSearch({
  onSelect,
  placeholder = "Search a US city…",
}: {
  onSelect: (g: GeoResult) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (timer.current) clearTimeout(timer.current);
    // All state updates happen inside the timer callback, never synchronously
    // in the effect body.
    timer.current = setTimeout(
      async () => {
        if (query.length < 2) {
          setResults([]);
          setError(null);
          setBusy(false);
          return;
        }
        setBusy(true);
        const res = await searchLocations(query);
        setBusy(false);
        if (res.ok) {
          setResults(res.results);
          setOpen(true);
          setError(res.results.length === 0 ? "No US matches." : null);
        } else {
          setResults([]);
          setError(res.error);
        }
      },
      query.length < 2 ? 0 : 300,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="relative">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full"
        spellCheck={false}
      />
      {busy && <p className="mt-1 text-xs text-muted">Searching…</p>}
      {error && !busy && <p className="mt-1 text-xs text-down">{error}</p>}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.name}-${i}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(r);
                  setQ("");
                  setResults([]);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-background"
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
