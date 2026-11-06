// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cryptoDecimals,
  formatCryptoPrice,
  formatRate,
  groupZeros,
  rateDecimals,
} from "./format.ts";

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

test("cryptoDecimals: 2 at or above $1, else 4 significant digits", () => {
  assert.equal(cryptoDecimals(75882.38), 2);
  assert.equal(cryptoDecimals(1), 2);
  assert.equal(cryptoDecimals(0.99996), 2); // rounds up to 1.000
  assert.equal(cryptoDecimals(0.5), 4);
  assert.equal(cryptoDecimals(0.012345), 5);
  assert.equal(cryptoDecimals(0.000100473), 7);
  assert.equal(cryptoDecimals(0.0009999), 7);
  assert.equal(cryptoDecimals(0.00099996), 6); // rounds up to 0.001000
  assert.equal(cryptoDecimals(0.000000012345), 11);
  assert.equal(cryptoDecimals(0), 2);
});

test("groupZeros: collapses 4+ leading zeros into a subscript count", () => {
  assert.equal(groupZeros("0.0001005"), "0.0001005"); // 3 zeros: left alone
  assert.equal(groupZeros("0.00001234"), "0.0₄1234");
  assert.equal(groupZeros("0.00000001234"), "0.0₇1234");
  assert.equal(groupZeros("+0.00000006"), "+0.0₇6");
  assert.equal(groupZeros("-0.000000000000123"), "-0.0₁₂123");
  assert.equal(groupZeros("1.00"), "1.00");
  assert.equal(groupZeros("10.00001"), "10.00001");
});

test("formatCryptoPrice: 2 decimals ≥ $1, 4 significant digits below", () => {
  assert.equal(formatCryptoPrice(75882.38268), "75,882.38");
  assert.equal(formatCryptoPrice(1.5), "1.50");
  assert.equal(formatCryptoPrice(0.5), "0.5000");
  assert.equal(formatCryptoPrice(0.123456), "0.1235");
  assert.equal(formatCryptoPrice(0.000100473179895159), "0.0001005");
  assert.equal(formatCryptoPrice(0.000012345), "0.0₄1235");
  assert.equal(formatCryptoPrice(0.000000012345), "0.0₇1235");
});
