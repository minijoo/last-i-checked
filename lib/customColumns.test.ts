// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOM_DELTA_DIGITS, toCustomColumns } from "./customColumns.ts";

const at = (s: string) => new Date(s).getTime();

test("CUSTOM_DELTA_DIGITS is the 5-place hard cap", () => {
  assert.equal(CUSTOM_DELTA_DIGITS, 5);
});

test("delta keeps 5 decimal places (batting-average scale)", () => {
  const cols = toCustomColumns([
    { checkedAt: at("2026-09-04T10:00"), value: 0.31234 },
    { checkedAt: at("2026-09-05T10:00"), value: 0.31789 },
  ]);
  // newest first: [0.31789 (Δ), 0.31234 (no baseline)]
  assert.equal(cols[0].delta, 0.00555);
  assert.equal(cols[1].delta, null);
});

test("delta is rounded, not truncated, at the 5th place", () => {
  const cols = toCustomColumns([
    { checkedAt: at("2026-09-04T10:00"), value: 1 },
    { checkedAt: at("2026-09-05T10:00"), value: 1.0000049 },
  ]);
  assert.equal(cols[0].delta, 0); // 0.0000049 -> rounds to 0 at 5dp
});

test("text values carry no delta", () => {
  const cols = toCustomColumns([
    { checkedAt: at("2026-09-04T10:00"), value: "green" },
    { checkedAt: at("2026-09-05T10:00"), value: "red" },
  ]);
  assert.equal(cols[0].delta, null);
  assert.equal(cols[0].value, "red");
});
