"use client";

import { useMemo, useState } from "react";
import { LuArrowRight } from "react-icons/lu";
import { useCurrencyList } from "@/lib/currencyList";
import { store } from "@/lib/store";
import { Combobox, type ComboOption } from "./Combobox";
import { Button } from "./ui";

const DEFAULT_BASE = "USD";

export function AddCurrencyForm() {
  const { currencies, error: listError } = useCurrencyList();
  const [base, setBase] = useState(DEFAULT_BASE);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const options = useMemo<ComboOption[]>(
    () =>
      (currencies ?? []).map((c) => ({
        value: c.code,
        label: c.code,
        hint: c.name,
        search: [c.name],
      })),
    [currencies],
  );
  // A pair needs two different currencies.
  const targetOptions = useMemo(
    () => options.filter((o) => o.value !== base),
    [options, base],
  );

  function pickBase(code: string) {
    setBase(code);
    if (target === code) setTarget(null);
    setOk(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const added = await store.addTrackedCurrency(base, target);
      setOk(added ? `Added ${base} → ${target}` : `Already tracking ${base} → ${target}`);
      setTarget(null); // keep the base: adding several pairs off one base is common
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add pair.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = currencies === null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-36">
          <Combobox
            options={options}
            value={base}
            onChange={pickBase}
            placeholder="Base"
            disabled={disabled}
            listClassName="w-64"
          />
        </div>
        <LuArrowRight aria-hidden className="text-muted" />
        <div className="w-36">
          <Combobox
            options={targetOptions}
            value={target}
            onChange={(v) => {
              setTarget(v);
              setOk(null);
            }}
            placeholder="Target currency"
            disabled={disabled}
            // Right-aligned on narrow screens so the wide list opens leftward
            // instead of running off the right edge.
            listClassName="w-64 right-0 sm:right-auto"
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !target}>
          {busy ? "…" : "Add"}
        </Button>
      </div>
      {listError && (
        <p className="text-xs text-down">Couldn&apos;t load currencies: {listError}</p>
      )}
      {ok && <p className="text-xs text-up">{ok}</p>}
      {error && <p className="text-xs text-down">{error}</p>}
    </form>
  );
}
