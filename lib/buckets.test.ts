// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { toColumns, toTextColumns } from "./buckets.ts";

const at = (s: string) => new Date(s).getTime();

test("stock: multiple checks in a day collapse to one column, last value wins", () => {
  const cols = toColumns(
    [
      { checkedAt: at("2026-08-24T10:00"), value: 100 },
      { checkedAt: at("2026-08-28T09:00"), value: 101 },
      { checkedAt: at("2026-08-28T16:00"), value: 102 },
      { checkedAt: at("2026-09-01T11:00"), value: 105 },
    ],
    "stock",
  );
  assert.equal(cols.length, 3);
  assert.deepEqual(
    cols.map((c) => [c.value, c.delta]),
    [
      [105, 3],
      [102, 2],
      [100, null],
    ],
  );
});

test("weather: buckets split at local noon into AM/PM", () => {
  const cols = toColumns(
    [
      { checkedAt: at("2026-09-01T08:00"), value: 75 },
      { checkedAt: at("2026-09-01T13:00"), value: 78 },
      { checkedAt: at("2026-09-01T20:00"), value: 70 },
      { checkedAt: at("2026-09-02T09:00"), value: 68 },
    ],
    "weather",
  );
  assert.deepEqual(
    cols.map((c) => [c.key, c.value, c.delta]),
    [
      ["2026-09-02-AM", 68, -2],
      ["2026-09-01-PM", 70, -5],
      ["2026-09-01-AM", 75, null],
    ],
  );
});

test("limit keeps the newest columns", () => {
  const cols = toColumns(
    [
      { checkedAt: at("2026-08-24T10:00"), value: 100 },
      { checkedAt: at("2026-08-28T16:00"), value: 102 },
      { checkedAt: at("2026-09-01T11:00"), value: 105 },
    ],
    "stock",
    2,
  );
  assert.deepEqual(
    cols.map((c) => c.value),
    [105, 102],
  );
});

test("empty input yields no columns", () => {
  assert.deepEqual(toColumns([], "stock"), []);
});

test("text columns report changed vs previous bucket", () => {
  const cols = toTextColumns(
    [
      { checkedAt: at("2026-09-01T10:00"), value: "Sunny" },
      { checkedAt: at("2026-09-02T10:00"), value: "Cloudy" },
      { checkedAt: at("2026-09-03T10:00"), value: "Cloudy" },
    ],
    "stock",
  );
  assert.deepEqual(
    cols.map((c) => [c.value, c.changed]),
    [
      ["Cloudy", false],
      ["Cloudy", true],
      ["Sunny", null],
    ],
  );
});
