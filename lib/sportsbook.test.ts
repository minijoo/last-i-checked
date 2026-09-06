// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAmerican, formatPoint, toOddsColumns } from "./sportsbook.ts";

const at = (s: string) => new Date(s).getTime();

test("formatAmerican / formatPoint", () => {
  assert.equal(formatAmerican(150), "+150");
  assert.equal(formatAmerican(-110), "-110");
  assert.equal(formatAmerican(null), "—");
  assert.equal(formatPoint(-2.5), "-2.5");
  assert.equal(formatPoint(45.5), "45.5");
  assert.equal(formatPoint(null), "");
});

test("toOddsColumns: half-day buckets, last check wins, line + price deltas tracked separately", () => {
  const cols = toOddsColumns([
    { checkedAt: at("2026-09-01T08:00"), price: -105, point: 2.5, status: "ok" },
    { checkedAt: at("2026-09-01T20:00"), price: -110, point: 2.5, status: "ok" },
    { checkedAt: at("2026-09-02T09:00"), price: -120, point: 1.5, status: "ok" },
  ]);
  assert.deepEqual(
    cols.map((c) => c.key),
    ["2026-09-02-AM", "2026-09-01-PM", "2026-09-01-AM"],
  );
  // newest column vs the previous bucket: price -110 -> -120, line 2.5 -> 1.5
  assert.equal(cols[0].priceDelta, -10);
  assert.equal(cols[0].pointDelta, -1);
  // oldest shown column has no baseline
  assert.equal(cols[2].priceDelta, null);
  assert.equal(cols[2].pointDelta, null);
});

test("toOddsColumns: a price-only outcome (h2h/futures) has no pointDelta", () => {
  const cols = toOddsColumns([
    { checkedAt: at("2026-09-01T10:00"), price: -140, point: null, status: "ok" },
    { checkedAt: at("2026-09-02T10:00"), price: -125, point: null, status: "ok" },
  ]);
  assert.equal(cols[0].priceDelta, 15);
  assert.equal(cols[0].pointDelta, null);
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
  assert.equal(cols[0].priceDelta, null);
});

test("toOddsColumns: empty input yields no columns", () => {
  assert.deepEqual(toOddsColumns([]), []);
});
