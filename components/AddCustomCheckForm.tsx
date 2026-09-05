"use client";

import { useState } from "react";
import { store } from "@/lib/store";
import { Button, Input } from "./ui";

interface SuggestResponse {
  ok: boolean;
  selector?: string;
  matchedText?: string;
  confidence?: "high" | "low";
  error?: string;
}

export function AddCustomCheckForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selector, setSelector] = useState("");
  const [valueType, setValueType] = useState<"number" | "text">("number");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [matchedText, setMatchedText] = useState<string | null>(null);

  function reset() {
    setName("");
    setUrl("");
    setDescription("");
    setSelector("");
    setMatchedText(null);
  }

  async function suggest() {
    const u = url.trim();
    const d = description.trim();
    if (!u) {
      setSuggestError("Enter a URL first.");
      return;
    }
    if (!d) {
      setSuggestError("Describe the value you want to track first.");
      return;
    }
    try {
      new URL(u);
    } catch {
      setSuggestError("That doesn't look like a valid URL.");
      return;
    }
    setSuggesting(true);
    setSuggestError(null);
    setMatchedText(null);
    try {
      const res = await fetch("/api/custom-check/suggest-selector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u, description: d, valueType }),
      });
      const result: SuggestResponse = await res.json();
      if (!result.ok || !result.selector) {
        setSuggestError(result.error ?? "Couldn't suggest a selector.");
        return;
      }
      setSelector(result.selector);
      setMatchedText(result.matchedText ?? null);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const u = url.trim();
    const s = selector.trim();
    if (!n || !u || !s) {
      setError("Name, URL, and selector are all required.");
      return;
    }
    try {
      new URL(u);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await store.addTrackedCustom({ name: n, url: u, selector: s, valueType });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add check.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-40"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-56"
        />
        <select
          value={valueType}
          onChange={(e) => setValueType(e.target.value as "number" | "text")}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground"
        >
          <option value="number">Number</option>
          <option value="text">Text</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the value, e.g. &quot;the current stock price&quot;"
          className="w-72"
        />
        <Button type="button" variant="outline" onClick={suggest} disabled={suggesting}>
          {suggesting ? "Suggesting…" : "Suggest selector"}
        </Button>
      </div>
      {suggestError && <p className="text-xs text-down">{suggestError}</p>}
      {matchedText && (
        <p className="text-xs text-muted">
          Matched: <span className="font-mono text-foreground">{matchedText}</span> — check
          the selector below before adding.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
          placeholder="CSS selector"
          className="w-64 font-mono"
          spellCheck={false}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "…" : "Add"}
        </Button>
      </div>
      {error && <p className="text-xs text-down">{error}</p>}
    </form>
  );
}
