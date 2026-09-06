// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { relDaySpans, unionAxis } from "./matrix.ts";

test("unionAxis: half-day keys → absolute 'M/D AM|PM' labels, newest first, capped", () => {
  const axis = unionAxis(
    [
      [{ key: "2026-09-04-AM" }, { key: "2026-09-04-PM" }],
      [{ key: "2026-09-05-AM" }],
    ],
    2,
  );
  assert.deepEqual(
    axis.map((c) => [c.key, c.absLabel, c.dayKey]),
    [
      ["2026-09-05-AM", "9/5 AM", "2026-09-05"],
      ["2026-09-04-PM", "9/4 PM", "2026-09-04"],
    ],
  );
});

test("unionAxis: timeLabel is the latest check time in the bucket", () => {
  const at = (s: string) => new Date(s).getTime();
  const axis = unionAxis([
    [
      { key: "2026-09-06-PM", at: at("2026-09-06T15:10") },
      { key: "2026-09-06-PM", at: at("2026-09-06T22:51") }, // later wins
    ],
    [{ key: "2026-09-05-AM", at: at("2026-09-05T09:03") }],
  ]);
  assert.deepEqual(
    axis.map((c) => c.timeLabel),
    ["10:51PM", "9:03AM"],
  );
});

test("unionAxis: timeLabel is '' when no check time is available", () => {
  const axis = unionAxis([[{ key: "2026-09-06" }]]);
  assert.equal(axis[0].timeLabel, "");
});

test("unionAxis: calendar-day keys get a bare 'M/D' label", () => {
  const axis = unionAxis([[{ key: "2026-09-06" }, { key: "2026-09-05" }]]);
  assert.deepEqual(
    axis.map((c) => [c.absLabel, c.dayKey]),
    [
      ["9/6", "2026-09-06"],
      ["9/5", "2026-09-05"],
    ],
  );
});

test("relDaySpans: adjacent same-day columns merge into one relative-date cell", () => {
  const axis = unionAxis([
    [
      { key: "2026-09-04-AM" },
      { key: "2026-09-04-PM" },
      { key: "2026-09-03-PM" },
    ],
  ]);
  // newest first: 9/4 PM, 9/4 AM, 9/3 PM
  const spans = relDaySpans(axis);
  assert.equal(spans.length, 2);
  assert.deepEqual(
    spans.map((s) => s.span),
    [2, 1],
  );
});

test("relDaySpans: calendar-day axis → one cell per column", () => {
  const axis = unionAxis([
    [{ key: "2026-09-06" }, { key: "2026-09-05" }, { key: "2026-09-03" }],
  ]);
  assert.deepEqual(
    relDaySpans(axis).map((s) => s.span),
    [1, 1, 1],
  );
});
