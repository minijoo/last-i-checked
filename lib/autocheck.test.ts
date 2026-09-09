// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changesForStocks,
  dueRuns,
  isValidSlotTime,
  mergeAutocheck,
  parseHHMM,
  todayAtLocal,
} from "./autocheck.ts";
import type { AutocheckConfig } from "./types.ts";

const at = (s: string) => new Date(s).getTime();

function cfg(over: Partial<AutocheckConfig["slots"]> = {}, enabled = true): AutocheckConfig {
  return mergeAutocheck({ enabled, notify: true, slots: over });
}

test("mergeAutocheck: a never-configured value gets the default slot times, disabled", () => {
  const c = mergeAutocheck(undefined);
  assert.equal(c.enabled, false);
  assert.deepEqual(c.slots.stocks, { day: "15:30" });
  assert.deepEqual(c.slots.weather, { am: "06:00", pm: "18:00" });
  assert.deepEqual(c.slots.sportsbook, { am: "06:00", pm: "18:00" });
  assert.deepEqual(c.slots.custom, { day: "18:00" });
});

test("mergeAutocheck: once saved, explicit nulls (slots turned off) are kept", () => {
  const c = mergeAutocheck({
    enabled: true,
    notify: true,
    slots: {
      stocks: { day: null },
      custom: { day: "07:00" },
      weather: { am: null, pm: "20:00" },
      sportsbook: { am: null, pm: null },
    },
  });
  assert.equal(c.slots.stocks.day, null);
  assert.equal(c.slots.custom.day, "07:00");
  assert.equal(c.slots.weather.am, null);
  assert.equal(c.slots.weather.pm, "20:00");
});

test("parseHHMM / isValidSlotTime", () => {
  assert.equal(parseHHMM("09:30"), 570);
  assert.equal(parseHHMM("9:5"), null);
  assert.equal(parseHHMM("24:00"), null);
  assert.equal(isValidSlotTime("am", "11:59"), true);
  assert.equal(isValidSlotTime("am", "12:00"), false);
  assert.equal(isValidSlotTime("pm", "12:00"), true);
  assert.equal(isValidSlotTime("pm", "11:59"), false);
  assert.equal(isValidSlotTime("day", "23:00"), true);
});

test("todayAtLocal: today's date at HH:MM", () => {
  const now = new Date("2026-09-08T15:20:00");
  const d = todayAtLocal(now, "09:00");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 8);
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMinutes(), 0);
});

test("dueRuns: not due before the slot time", () => {
  const now = new Date("2026-09-08T08:00:00");
  assert.deepEqual(dueRuns(now, cfg({ stocks: { day: "09:00" } }), {}), []);
});

test("dueRuns: due after the slot time, never fetched", () => {
  const now = new Date("2026-09-08T09:05:00");
  const runs = dueRuns(now, cfg({ stocks: { day: "09:00" } }), {});
  assert.equal(runs.length, 1);
  assert.equal(runs[0].category, "stocks");
  assert.equal(runs[0].stampAt, at("2026-09-08T09:00:00"));
});

test("dueRuns: not due once fetched since the slot time", () => {
  const now = new Date("2026-09-08T09:30:00");
  const lf = { stocks: at("2026-09-08T09:06:00") };
  assert.deepEqual(dueRuns(now, cfg({ stocks: { day: "09:00" } }), lf), []);
});

test("dueRuns: catch-up — device off all morning, open at 15:00", () => {
  const now = new Date("2026-09-08T15:00:00");
  const lf = { weather: at("2026-09-07T18:00:00") }; // yesterday
  const runs = dueRuns(
    now,
    cfg({ weather: { am: "09:00", pm: "18:00" } }),
    lf,
  );
  // AM is due (15:00 ≥ 09:00, no fetch since); PM is not (15:00 < 18:00)
  assert.deepEqual(
    runs.map((r) => r.slot),
    ["am"],
  );
  assert.equal(runs[0].stampAt, at("2026-09-08T09:00:00"));
});

test("dueRuns: disabled config yields nothing", () => {
  const now = new Date("2026-09-08T12:00:00");
  assert.deepEqual(
    dueRuns(now, cfg({ stocks: { day: "09:00" } }, false), {}),
    [],
  );
});

test("changesForStocks: reports only symbols whose latest bucket moved", () => {
  const mk = (symbol: string, checkedAt: number, price: number) => ({
    checkedAt,
    symbol,
    price,
  });
  const changes = changesForStocks(
    [
      { symbol: "NVDA", addedAt: 0 },
      { symbol: "AAPL", addedAt: 0 },
    ],
    [
      mk("NVDA", at("2026-09-06T10:00"), 175.32),
      mk("NVDA", at("2026-09-08T10:00"), 178.42),
      mk("AAPL", at("2026-09-06T10:00"), 231.1),
      mk("AAPL", at("2026-09-08T10:00"), 231.1), // unchanged
    ],
  );
  assert.deepEqual(
    changes.map((c) => [c.label, c.text]),
    [["NVDA", "+3.10 → 178.42"]],
  );
});
