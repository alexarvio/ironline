import { test } from "node:test";
import assert from "node:assert/strict";
import { agoLabel, agreedPoints, daysUntil, startingNow, untilLabel } from "./meetingDates";

// Run: node --import tsx --test app/lib/meetingDates.test.ts
// Local-time helpers: the moments below are built with the local Date
// constructor, so the tests hold in any timezone.

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const now = at(2026, 10, 9, 14, 0);

test("days until, by calendar day not by 24h", () => {
  assert.equal(daysUntil(at(2026, 10, 9, 23, 59), now), 0);
  assert.equal(daysUntil(at(2026, 10, 10, 0, 1), now), 1);
  assert.equal(daysUntil(at(2026, 10, 13), now), 4);
  assert.equal(daysUntil(at(2026, 10, 6), now), -3);
});

test("until: today, tomorrow, in N days", () => {
  assert.equal(untilLabel(at(2026, 10, 9, 18), now), "Today");
  assert.equal(untilLabel(at(2026, 10, 10, 9), now), "Tomorrow");
  assert.equal(untilLabel(at(2026, 10, 13, 18), now), "In 4 days");
});

test("ago: days, weeks from fourteen, the month past sixty", () => {
  assert.equal(agoLabel(at(2026, 10, 9, 9), now), "today");
  assert.equal(agoLabel(at(2026, 10, 8), now), "yesterday");
  assert.equal(agoLabel(at(2026, 10, 6), now), "3 days ago");
  assert.equal(agoLabel(at(2026, 9, 25), now), "2 weeks ago");
  assert.equal(agoLabel(at(2026, 7, 20), now), "in July");
  assert.equal(agoLabel(at(2025, 12, 20), now), "in December 2025");
});

test("starting now: ten minutes before until the end", () => {
  const start = at(2026, 10, 9, 14, 5);
  assert.equal(startingNow(start, 30, now), true);
  assert.equal(startingNow(start, 30, start - 11 * 60000), false);
  assert.equal(startingNow(start, 30, start + 30 * 60000), true);
  assert.equal(startingNow(start, 30, start + 31 * 60000), false);
});

test("agreed points: lines with bullets stripped; one block stays prose", () => {
  assert.deepEqual(agreedPoints("- Train 4 days\n• Protein 180 g\n3. Sleep by 11"), { points: ["Train 4 days", "Protein 180 g", "Sleep by 11"], prose: false });
  assert.deepEqual(agreedPoints("We talked about the cut and decided to keep going."), { points: ["We talked about the cut and decided to keep going."], prose: true });
  assert.deepEqual(agreedPoints(["a", " ", "b"]), { points: ["a", "b"], prose: false });
  assert.deepEqual(agreedPoints(null), { points: [], prose: false });
});
