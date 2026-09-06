// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAmerican,
  formatPoint,
  impliedProb,
  probDeltaPP,
  toOddsColumns,
} from "./sportsbook.ts";

const at = (s: string) => new Date(s).getTime();

test("impliedProb: favorite and underdog", () => {
  assert.ok(Math.abs(impliedProb(-110) - 110 / 210) < 1e-9);
  assert.ok(Math.abs(impliedProb(+150) - 100 / 250) < 1e-9);
  assert.ok(Math.abs(impliedProb(+100) - 0.5) < 1e-9);
});

test("probDeltaPP: small move across the ±100 boundary is small", () => {
  // -110 -> +105 looks like a 215-point swing on the American scale, but the
  // implied-probability move is only a few points.
  const pp = probDeltaPP(-110, +105);
  assert.ok(pp < 0, "odds lengthened => probability fell");
  assert.ok(Math.abs(pp) < 5, `expected a small move, got ${pp}`);
});

test("probDeltaPP: shortening odds is a positive (up) move", () => {
  assert.ok(probDeltaPP(-110, -140) > 0);
});

test("formatAmerican / formatPoint", () => {
  assert.equal(formatAmerican(150), "+150");
  assert.equal(formatAmerican(-110), "-110");
  assert.equal(formatAmerican(null), "—");
  assert.equal(formatPoint(-2.5), "-2.5");
  assert.equal(formatPoint(45.5), "45.5");
  assert.equal(formatPoint(null), "");
});

test("toOddsColumns: half-day buckets, last check wins, prob + line deltas", () => {
  const cols = toOddsColumns([
    { checkedAt: at("2026-09-01T08:00"), price: -105, point: 2.5, status: "ok" },
    { checkedAt: at("2026-09-01T20:00"), price: -110, point: 2.5, status: "ok" },
    { checkedAt: at("2026-09-02T09:00"), price: -120, point: 1.5, status: "ok" },
  ]);
  assert.deepEqual(
    cols.map((c) => c.key),
    ["2026-09-02-AM", "2026-09-01-PM", "2026-09-01-AM"],
  );
  // newest column: -110 -> -120 shortens (prob up), line 2.5 -> 1.5 moves -1
  assert.ok((cols[0].probDeltaPP ?? 0) > 0);
  assert.equal(cols[0].pointDelta, -1);
  // oldest shown column has no baseline
  assert.equal(cols[2].probDeltaPP, null);
  assert.equal(cols[2].pointDelta, null);
});

test("toOddsColumns: an unavailable check contributes no delta", () => {
  const cols = toOddsColumns([
    { checkedAt: at("2026-09-01T10:00"), price: -110, point: null, status: "ok" },
    {
      checkedAt: at("2026-09-02T10:00"),
      price: null,
      point: null,
      status: "unavailable",
    },
  ]);
  assert.equal(cols[0].price, null);
  assert.equal(cols[0].status, "unavailable");
  assert.equal(cols[0].probDeltaPP, null);
});

test("toOddsColumns: empty input yields no columns", () => {
  assert.deepEqual(toOddsColumns([]), []);
});
