import { test } from "node:test";
import assert from "node:assert/strict";
import { dayOf, rangeLabel, relativeLabel, statusOf, todayLabel } from "./eventDates";

// Run: node --import tsx --test app/lib/eventDates.test.ts

const today = "2026-10-08";

test("status: a stretch that starts today is now", () => {
  assert.equal(statusOf({ start: "2026-10-08", end: "2026-10-12" }, today), "now");
});

test("status: a stretch that ends today is still now", () => {
  assert.equal(statusOf({ start: "2026-10-01", end: "2026-10-08" }, today), "now");
});

test("status: a single day today is a milestone, never now", () => {
  assert.equal(statusOf({ start: "2026-10-08", end: "2026-10-08" }, today), "past");
  assert.equal(relativeLabel({ start: "2026-10-08", end: "2026-10-08" }, today), "today");
});

test("status: tomorrow is next, yesterday is past", () => {
  assert.equal(statusOf({ start: "2026-10-09", end: "2026-10-09" }, today), "next");
  assert.equal(statusOf({ start: "2026-10-01", end: "2026-10-07" }, today), "past");
});

test("relative: coming up in days, weeks from three", () => {
  assert.equal(relativeLabel({ start: "2026-10-09", end: "2026-10-09" }, today), "tomorrow");
  assert.equal(relativeLabel({ start: "2026-10-20", end: "2026-11-20" }, today), "in 12 days");
  assert.equal(relativeLabel({ start: "2026-10-29", end: "2026-10-29" }, today), "in 3 weeks");
});

test("relative: now counts the day, first and last included", () => {
  assert.equal(relativeLabel({ start: "2026-10-01", end: "2026-10-22" }, today), "Day 8 of 22");
  assert.deepEqual(dayOf({ start: "2026-10-08", end: "2026-10-08" }, today), { day: 1, total: 1 });
});

test("relative: past stretches say ended, single days do not", () => {
  assert.equal(relativeLabel({ start: "2026-09-22", end: "2026-10-03" }, today), "ended 5 days ago");
  assert.equal(relativeLabel({ start: "2026-10-07", end: "2026-10-07" }, today), "yesterday");
  assert.equal(relativeLabel({ start: "2026-09-08", end: "2026-09-12" }, today), "ended 4 weeks ago");
  assert.equal(relativeLabel({ start: "2026-06-20", end: "2026-06-25" }, today), "ended in June");
  assert.equal(relativeLabel({ start: "2025-12-20", end: "2025-12-25" }, today), "ended in December 2025");
});

test("range: en dash, From for a future single day, year across the boundary", () => {
  assert.equal(rangeLabel({ start: "2026-10-20", end: "2026-11-20" }, today), "20 Oct – 20 Nov");
  assert.equal(rangeLabel({ start: "2026-10-13", end: "2026-10-13" }, today), "From 13 Oct");
  assert.equal(rangeLabel({ start: "2026-08-25", end: "2026-08-25" }, today), "25 Aug");
  assert.equal(rangeLabel({ start: "2026-12-28", end: "2027-01-04" }, today), "28 Dec – 4 Jan 2027");
});

test("today line", () => {
  assert.deepEqual(todayLabel(today), { short: "THU 8 OCT", long: "Today, Thursday 8 October" });
});

test("duration chip", async () => {
  const { durationLabel, addDays } = await import("./eventDates");
  assert.equal(durationLabel("2026-10-08", "2026-10-08", today), "Today");
  assert.equal(durationLabel("2026-10-10", "2026-10-10", today), "In 2 days");
  assert.equal(durationLabel("2026-10-05", "2026-10-05", today), "3 days ago");
  assert.equal(durationLabel("2026-10-08", "2026-10-14", today), "7 days · starts today");
  assert.equal(durationLabel("2026-10-20", "2026-11-20", today), "32 days · starts in 12 days");
  assert.equal(durationLabel("2026-10-06", "2026-10-10", today), "5 days · started 2 days ago");
  assert.equal(addDays("2026-12-30", 6), "2027-01-05");
});
