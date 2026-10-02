import assert from "node:assert/strict";
import test from "node:test";
import { getFocusTrend } from "../src/features/review/focusTrends.ts";

function localTimestamp(year, month, day, hour, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function session(id, startedAt, durationSeconds, status = "completed") {
  return {
    id,
    taskId: null,
    taskTitle: "",
    startedAt,
    endedAt: startedAt,
    durationSeconds,
    status,
    note: "",
  };
}

test("daily focus trend groups ended sessions into local four-hour buckets", () => {
  const trend = getFocusTrend({
    selectedDate: "2026-10-02",
    latestDate: "2026-10-02",
    range: "day",
    focusSessions: [
      session("morning-1", localTimestamp(2026, 10, 2, 8, 15), 1500),
      session("morning-2", localTimestamp(2026, 10, 2, 11, 45), 600, "stopped"),
      session("afternoon", localTimestamp(2026, 10, 2, 14), 1800),
      session("active", localTimestamp(2026, 10, 2, 9), 300, "active"),
      session("other-day", localTimestamp(2026, 10, 1, 23), 3600),
      session("invalid-time", "not-a-date", 1200),
      session("invalid-duration", localTimestamp(2026, 10, 2, 9), Number.NaN),
    ],
  });

  assert.equal(trend.buckets.length, 6);
  assert.deepEqual(trend.buckets.map((bucket) => bucket.durationSeconds), [0, 0, 2100, 1800, 0, 0]);
  assert.deepEqual(trend.buckets.map((bucket) => bucket.sessionCount), [0, 0, 2, 1, 0, 0]);
  assert.equal(trend.totalDurationSeconds, 3900);
  assert.equal(trend.sessionCount, 3);
  assert.equal(trend.activeBucketCount, 2);
});

test("weekly focus trend keeps Monday-to-Sunday context and excludes future sessions", () => {
  const trend = getFocusTrend({
    selectedDate: "2026-10-02",
    latestDate: "2026-10-02",
    range: "week",
    focusSessions: [
      session("monday", localTimestamp(2026, 9, 28, 9), 1200),
      session("friday", localTimestamp(2026, 10, 2, 10), 1800),
      session("future-saturday", localTimestamp(2026, 10, 3, 10), 2400),
    ],
  });

  assert.equal(trend.startDate, "2026-09-28");
  assert.equal(trend.endDate, "2026-10-04");
  assert.deepEqual(trend.buckets.map((bucket) => bucket.date), [
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
  assert.deepEqual(trend.buckets.map((bucket) => bucket.isFuture), [false, false, false, false, false, true, true]);
  assert.equal(trend.totalDurationSeconds, 3000);
  assert.equal(trend.sessionCount, 2);
});

test("historical weekly focus trend includes the complete Monday-to-Sunday period", () => {
  const trend = getFocusTrend({
    selectedDate: "2026-09-30",
    latestDate: "2026-10-02",
    range: "week",
    focusSessions: [],
  });

  assert.equal(trend.startDate, "2026-09-28");
  assert.equal(trend.endDate, "2026-10-04");
  assert.equal(trend.buckets.length, 7);

  const completedPastTrend = getFocusTrend({
    selectedDate: "2026-09-20",
    latestDate: "2026-10-02",
    range: "week",
    focusSessions: [],
  });

  assert.equal(completedPastTrend.startDate, "2026-09-14");
  assert.equal(completedPastTrend.endDate, "2026-09-20");
  assert.equal(completedPastTrend.buckets.length, 7);
});

test("monthly focus trend uses every reached calendar day and handles leap years", () => {
  const trend = getFocusTrend({
    selectedDate: "2024-02-12",
    latestDate: "2024-03-03",
    range: "month",
    focusSessions: [
      session("first", localTimestamp(2024, 2, 1, 9), 600),
      session("leap-day", localTimestamp(2024, 2, 29, 9), 900),
      session("march", localTimestamp(2024, 3, 1, 9), 1200),
    ],
  });

  assert.equal(trend.startDate, "2024-02-01");
  assert.equal(trend.endDate, "2024-02-29");
  assert.equal(trend.buckets.length, 29);
  assert.equal(trend.totalDurationSeconds, 1500);
  assert.equal(trend.sessionCount, 2);
  assert.equal(trend.buckets.at(-1)?.date, "2024-02-29");
  assert.equal(trend.buckets.some((bucket) => bucket.isFuture), false);
});

test("current monthly trend keeps future days visible but excludes their records", () => {
  const trend = getFocusTrend({
    selectedDate: "2026-10-02",
    latestDate: "2026-10-02",
    range: "month",
    focusSessions: [
      session("today", localTimestamp(2026, 10, 2, 9), 600),
      session("future", localTimestamp(2026, 10, 20, 9), 1200),
    ],
  });

  assert.equal(trend.buckets.length, 31);
  assert.equal(trend.totalDurationSeconds, 600);
  assert.equal(trend.sessionCount, 1);
  assert.equal(trend.buckets.filter((bucket) => bucket.isFuture).length, 29);
});

test("negative durations remain neutral zero facts without creating active buckets", () => {
  const trend = getFocusTrend({
    selectedDate: "2026-10-02",
    latestDate: "2026-10-02",
    range: "day",
    focusSessions: [session("negative", localTimestamp(2026, 10, 2, 9), -30)],
  });

  assert.equal(trend.totalDurationSeconds, 0);
  assert.equal(trend.sessionCount, 1);
  assert.equal(trend.activeBucketCount, 0);
});
