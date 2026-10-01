import assert from "node:assert/strict";
import test from "node:test";
import { getDailyRecordOverview, isReviewDateAllowed, shiftReviewDate } from "../src/features/review/dailyRecords.ts";

test("daily overview derives task, focus, and reflection facts for the selected local date", () => {
  const octoberFirstMorning = new Date(2026, 9, 1, 9, 30).toISOString();
  const septemberThirtiethEvening = new Date(2026, 8, 30, 23, 50).toISOString();
  const overview = getDailyRecordOverview({
    date: "2026-10-01",
    tasks: [
      { id: "task-1", title: "完成页面", createdAt: octoberFirstMorning, completed: true, priority: "high", date: "2026-10-01", notes: "" },
      { id: "task-2", title: "明天处理", createdAt: octoberFirstMorning, completed: false, priority: "low", date: "2026-10-02", notes: "" },
    ],
    focusSessions: [
      { id: "focus-1", taskId: "task-1", taskTitle: "完成页面", startedAt: octoberFirstMorning, endedAt: new Date(2026, 9, 1, 10).toISOString(), durationSeconds: 1800, status: "completed", note: "" },
      { id: "focus-2", taskId: null, taskTitle: "", startedAt: septemberThirtiethEvening, endedAt: new Date(2026, 9, 1, 0, 10).toISOString(), durationSeconds: 1200, status: "stopped", note: "" },
    ],
    readingActions: [{ id: "read-1", articleId: "article-1", articleTitle: "回顾文章", articleLink: "https://example.com", feedId: "feed-1", feedTitle: "示例来源", openedAt: octoberFirstMorning }],
    dailyReflections: [{ date: "2026-10-01", summary: "推进顺利", energy: 4, satisfaction: 4, updatedAt: octoberFirstMorning }],
  });

  assert.deepEqual(overview, {
    taskCount: 1,
    completedTaskCount: 1,
    focusSessionCount: 1,
    readingActionCount: 1,
    hasReflection: true,
    hasRecords: true,
  });
});

test("empty dates stay factual and do not borrow records from another day", () => {
  const overview = getDailyRecordOverview({
    date: "2026-10-01",
    tasks: [],
    focusSessions: [],
    readingActions: [],
    dailyReflections: [],
  });

  assert.equal(overview.hasRecords, false);
  assert.equal(overview.taskCount, 0);
  assert.equal(overview.focusSessionCount, 0);
  assert.equal(overview.readingActionCount, 0);
  assert.equal(overview.hasReflection, false);
});

test("review date navigation accepts history and clamps navigation at today", () => {
  assert.equal(isReviewDateAllowed("2026-09-30", "2026-10-01"), true);
  assert.equal(isReviewDateAllowed("2026-10-02", "2026-10-01"), false);
  assert.equal(isReviewDateAllowed("2026-02-30", "2026-10-01"), false);
  assert.equal(shiftReviewDate("2026-09-30", 1, "2026-10-01"), "2026-10-01");
  assert.equal(shiftReviewDate("2026-10-01", 1, "2026-10-01"), "2026-10-01");
  assert.equal(shiftReviewDate("invalid", -1, "2026-10-01"), "2026-10-01");
});
