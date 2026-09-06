"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { fuzzyFilter } from "@/lib/fuzzy";
import { Input } from "./ui";

export interface ComboOption {
  value: string;
  label: string;
  group?: string; // shown as a sticky header when `grouped`
  hint?: string; // muted text after the label
  search?: string[]; // extra strings to fuzzy-match on
}

/**
 * Searchable single-select. Opens showing the whole list; typing fuzzy-filters
 * it (client-side — the list is already in memory). Keyboard navigable. When
 * `grouped`, options keep their `group` header wherever a child matches.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  disabled = false,
  grouped = false,
}: {
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  grouped?: boolean;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const matched = fuzzyFilter(q, options, (o) => [
      o.label,
      o.group,
      o.hint,
      ...(o.search ?? []),
    ]);
    if (!grouped) return matched;
    // Keep score order, but make each group contiguous (first appearance wins).
    const order: string[] = [];
    for (const o of matched) {
      const g = o.group ?? "";
      if (!order.includes(g)) order.push(g);
    }
    return matched
      .slice()
      .sort((a, b) => order.indexOf(a.group ?? "") - order.indexOf(b.group ?? ""));
  }, [q, options, grouped]);

  function commit(opt: ComboOption | undefined) {
    if (!opt) return;
    onChange(opt.value);
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[active]) {
        e.preventDefault();
        commit(filtered[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQ("");
    }
  }

  const showGroupHeader = filtered.map(
    (o, i) => grouped && !!o.group && o.group !== filtered[i - 1]?.group,
  );

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={open ? q : (selected?.label ?? "")}
        placeholder={selected ? selected.label : placeholder}
        spellCheck={false}
        className="w-full"
        onFocus={() => {
          setOpen(true);
          setQ("");
          setActive(0);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            setQ("");
          }, 150);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matches.</li>
          )}
          {filtered.map((o, i) => {
            return (
              <li key={o.value}>
                {showGroupHeader[i] && (
                  <div className="sticky top-0 bg-surface px-3 pt-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                    {o.group}
                  </div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    commit(o);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === active ? "bg-background" : ""
                  } ${o.value === value ? "text-foreground" : ""}`}
                >
                  {o.label}
                  {o.hint && (
                    <span className="ml-2 text-xs text-muted">{o.hint}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
