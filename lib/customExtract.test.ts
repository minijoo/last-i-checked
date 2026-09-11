// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { extractNumber } from "./customExtract.ts";

test("asis strips everything but digits, dot, and minus", () => {
  assert.equal(extractNumber("$1,300.50", "asis").value, 1300.5); // comma dropped
  assert.equal(extractNumber("-3.5 pts", "asis").value, -3.5);
  assert.equal(extractNumber("no numbers here", "asis").value, null);
});

test("first/second/third/fourth pick the Nth number occurrence", () => {
  const text = "Compare 5 flights: price dropped from $1,300 to $987 (a $313 drop)";
  assert.equal(extractNumber(text, "first").value, 5);
  assert.equal(extractNumber(text, "second").value, 1300); // comma-grouped = one occurrence
  assert.equal(extractNumber(text, "third").value, 987);
  assert.equal(extractNumber(text, "fourth").value, 313);
});

test("ordinal method errors when there aren't enough numbers", () => {
  const r = extractNumber("only one: 42", "second");
  assert.equal(r.value, null);
  assert.match(r.error!, /second number/i);
});

test("regex uses a capture group when present, else the whole match", () => {
  assert.equal(extractNumber("Zestimate: $789,000", "regex", "\\$([\\d,]+)").value, 789000);
  assert.equal(extractNumber("42 items", "regex", "\\d+").value, 42);
});

test("regex errors on no match, non-numeric match, or bad pattern", () => {
  assert.equal(extractNumber("no digits", "regex", "\\d+").value, null);
  assert.equal(extractNumber("abc", "regex", "[a-z]+").value, null);
  const bad = extractNumber("abc", "regex", "(unterminated");
  assert.equal(bad.value, null);
  assert.match(bad.error!, /invalid regex/i);
});

test("regex with an empty pattern is an error, not a match-anything", () => {
  const r = extractNumber("42", "regex", "");
  assert.equal(r.value, null);
  assert.match(r.error!, /enter a regex/i);
});
