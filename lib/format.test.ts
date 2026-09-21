// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRate, rateDecimals } from "./format.ts";

test("rateDecimals: 5 significant digits across the range of FX rates", () => {
  assert.equal(rateDecimals(0.74939), 5);
  assert.equal(rateDecimals(0.8726), 5);
  assert.equal(rateDecimals(1.4045), 4);
  assert.equal(rateDecimals(157.89), 2);
  assert.equal(rateDecimals(1388.1), 1);
  assert.equal(rateDecimals(17823), 0);
  assert.equal(rateDecimals(0.000056106), 9);
  assert.equal(rateDecimals(0), 4);
});

test("formatRate: fixed decimals per magnitude, thousands separators", () => {
  assert.equal(formatRate(0.8726), "0.87260");
  assert.equal(formatRate(0.74939), "0.74939");
  assert.equal(formatRate(157.89), "157.89");
  assert.equal(formatRate(1388.1), "1,388.1");
  assert.equal(formatRate(17823), "17,823");
});
