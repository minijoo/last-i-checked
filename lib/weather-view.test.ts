// Run with: npm test   (node --test, no extra deps)
import assert from "node:assert/strict";
import { test } from "node:test";
import type { WeatherCheck } from "./types.ts";
import {
  fmtRain,
  fmtTemp,
  fmtWind,
  numColumnsFor,
  rainDigits,
  rainValue,
  windValue,
} from "./weather-view.ts";

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
    { temp: "F" },
  );
  assert.equal(cols[0].value, 86);
  assert.equal(cols[0].delta, 18);
});

test("numColumnsFor: °C converts each value BEFORE bucketing, delta is in °C", () => {
  const cols = numColumnsFor(
    [wc(at("2026-09-04T09:00"), 68, 50), wc(at("2026-09-05T09:00"), 71, 51)],
    "day",
    { temp: "C" },
  );
  assert.ok(Math.abs(cols[1].value - ((68 - 32) * 5) / 9) < 1e-9); // 20
  assert.ok(Math.abs(cols[0].value - ((71 - 32) * 5) / 9) < 1e-9); // 21.666…
  // 3°F step -> 3 * 5/9 = 1.666… °C, computed from the converted values
  assert.ok(Math.abs((cols[0].delta ?? 0) - (3 * 5) / 9) < 1e-6);
});

test("numColumnsFor: rain/wind views ignore the temp unit", () => {
  const checks = [wc(at("2026-09-04T09:00"), 68, 50)];
  checks[0].windSpeed = 10;
  const cols = numColumnsFor(checks, "wind", { temp: "C" });
  assert.equal(cols[0].value, 10);
});

function rw(checkedAt: number, rainAmt: number, windSpeed: number): WeatherCheck {
  return { ...wc(checkedAt, 60, 50), rainAmt, windSpeed };
}

test("rain: inches by default (mm / 25.4), mm passes stored values through", () => {
  const checks = [rw(at("2026-09-04T09:00"), 2.54, 0), rw(at("2026-09-05T09:00"), 12.7, 0)];
  const inch = numColumnsFor(checks, "rain");
  assert.ok(Math.abs(inch[0].value - 0.5) < 1e-9);
  assert.ok(Math.abs((inch[0].delta ?? 0) - 0.4) < 1e-9);
  const mm = numColumnsFor(checks, "rain", { rain: "mm" });
  assert.equal(mm[0].value, 12.7);
  assert.ok(Math.abs((mm[0].delta ?? 0) - 10.16) < 1e-9);
});

test("wind: mph by default, m/s converts BEFORE bucketing", () => {
  const checks = [rw(at("2026-09-04T09:00"), 0, 10), rw(at("2026-09-05T09:00"), 0, 20)];
  assert.equal(numColumnsFor(checks, "wind")[0].value, 20);
  const ms = numColumnsFor(checks, "wind", { wind: "ms" });
  assert.ok(Math.abs(ms[0].value - 8.9408) < 1e-9);
  assert.ok(Math.abs((ms[0].delta ?? 0) - 4.4704) < 1e-9); // 10 mph step
  assert.equal(windValue(10, "mph"), 10);
  assert.equal(rainValue(25.4, "mm"), 25.4);
});

test("fmtRain: 2 dp for inches, 1 dp for mm", () => {
  assert.equal(fmtRain("in")(0.456), '0.46"');
  assert.equal(fmtRain("mm")(12.34), "12.3 mm");
  assert.equal(rainDigits("in"), 2);
  assert.equal(rainDigits("mm"), 1);
});

test("fmtWind: whole numbers in both units", () => {
  assert.equal(fmtWind("mph")(12.6), "13 mph");
  assert.equal(fmtWind("ms")(5.4), "5 m/s");
});
