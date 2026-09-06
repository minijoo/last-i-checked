// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WeatherCheck } from "./types.ts";
import { fmtTemp, numColumnsFor } from "./weather-view.ts";

const at = (s: string) => new Date(s).getTime();

function wc(checkedAt: number, tempDay: number, tempNight: number): WeatherCheck {
  return {
    checkedAt,
    dateStr: "20260904",
    location: "X",
    latLong: [0, 0],
    tempDay,
    tempNight,
    tempUnit: "F",
    rainAmt: 0,
    windSpeed: 0,
    source: "forecast",
  };
}

test("fmtTemp: 0 dp for °F, 1 dp for °C", () => {
  assert.equal(fmtTemp("F")(72.6), "73°F");
  assert.equal(fmtTemp("C")(22.56), "22.6°C");
});

test("numColumnsFor: °F leaves values untouched", () => {
  const cols = numColumnsFor(
    [wc(at("2026-09-04T09:00"), 68, 50), wc(at("2026-09-05T09:00"), 86, 59)],
    "day",
    "F",
  );
  assert.equal(cols[0].value, 86);
  assert.equal(cols[0].delta, 18);
});

test("numColumnsFor: °C converts each value BEFORE bucketing, delta is in °C", () => {
  const cols = numColumnsFor(
    [wc(at("2026-09-04T09:00"), 68, 50), wc(at("2026-09-05T09:00"), 71, 51)],
    "day",
    "C",
  );
  assert.ok(Math.abs(cols[1].value - ((68 - 32) * 5) / 9) < 1e-9); // 20
  assert.ok(Math.abs(cols[0].value - ((71 - 32) * 5) / 9) < 1e-9); // 21.666…
  // 3°F step -> 3 * 5/9 = 1.666… °C, computed from the converted values
  assert.ok(Math.abs((cols[0].delta ?? 0) - (3 * 5) / 9) < 1e-6);
});

test("numColumnsFor: rain/wind views ignore the unit arg", () => {
  const checks = [wc(at("2026-09-04T09:00"), 68, 50)];
  checks[0].windSpeed = 10;
  const cols = numColumnsFor(checks, "wind", "C");
  assert.equal(cols[0].value, 10);
});
