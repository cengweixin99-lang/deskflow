import assert from "node:assert/strict";
import test from "node:test";
import { canScheduleTaskOn, getTaskEarliestDate } from "../src/features/tasks/taskDates.ts";

test("task dates cannot move before the local creation day", () => {
  const task = { createdAt: "2026-10-01T08:00:00.000Z", date: "2026-10-05" };

  assert.equal(getTaskEarliestDate(task), "2026-10-01");
  assert.equal(canScheduleTaskOn(task, "2026-09-30"), false);
  assert.equal(canScheduleTaskOn(task, "2026-10-01"), true);
  assert.equal(canScheduleTaskOn(task, "2026-10-03"), true);
});

test("invalid dates are rejected and malformed creation times fall back to the saved task date", () => {
  const task = { createdAt: "not-a-timestamp", date: "2026-10-05" };

  assert.equal(getTaskEarliestDate(task), "2026-10-05");
  assert.equal(canScheduleTaskOn(task, "2026-10-04"), false);
  assert.equal(canScheduleTaskOn(task, "2026-10-05"), true);
  assert.equal(canScheduleTaskOn(task, "2026-02-30"), false);
});
