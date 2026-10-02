import assert from "node:assert/strict";
import test from "node:test";
import { getDailyStats } from "../src/features/review/stats.ts";

function localTimestamp(year, month, day, hour, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

test("daily stats derive completion, actual focus duration, and stopped sessions from raw records", () => {
  const stats = getDailyStats({
    date: "2026-10-02",
    tasks: [
      { id: "task-1", title: "完成", createdAt: localTimestamp(2026, 10, 1, 9), completed: true, priority: "high", date: "2026-10-02", notes: "" },
      { id: "task-2", title: "未完成", createdAt: localTimestamp(2026, 10, 1, 9), completed: false, priority: "medium", date: "2026-10-02", notes: "" },
      { id: "task-other", title: "其他日期", createdAt: localTimestamp(2026, 10, 1, 9), completed: true, priority: "low", date: "2026-10-01", notes: "" },
    ],
    focusSessions: [
      { id: "focus-1", taskId: "task-1", taskTitle: "完成", startedAt: localTimestamp(2026, 10, 2, 9), endedAt: localTimestamp(2026, 10, 2, 9, 25), durationSeconds: 1500, status: "completed", note: "" },
      { id: "focus-2", taskId: null, taskTitle: "", startedAt: localTimestamp(2026, 10, 2, 11), endedAt: localTimestamp(2026, 10, 2, 11, 10), durationSeconds: 600, status: "stopped", note: "" },
      { id: "focus-active", taskId: null, taskTitle: "", startedAt: localTimestamp(2026, 10, 2, 13), endedAt: null, durationSeconds: 300, status: "active", note: "" },
      { id: "focus-other", taskId: null, taskTitle: "", startedAt: localTimestamp(2026, 10, 1, 23), endedAt: localTimestamp(2026, 10, 2, 0), durationSeconds: 3600, status: "completed", note: "" },
    ],
  });

  assert.deepEqual(stats, {
    taskCount: 2,
    completedTaskCount: 1,
    completionRate: 50,
    focusSessionCount: 2,
    focusDurationSeconds: 2100,
    stoppedFocusCount: 1,
  });
});

test("days without tasks use a null completion rate and keep neutral zero focus facts", () => {
  const stats = getDailyStats({ date: "2026-10-02", tasks: [], focusSessions: [] });

  assert.equal(stats.completionRate, null);
  assert.equal(stats.taskCount, 0);
  assert.equal(stats.focusDurationSeconds, 0);
  assert.equal(stats.stoppedFocusCount, 0);
});

test("completion rate rounds to a readable whole percentage", () => {
  const createdAt = localTimestamp(2026, 10, 1, 9);
  const stats = getDailyStats({
    date: "2026-10-02",
    tasks: [
      { id: "task-1", title: "一", createdAt, completed: true, priority: "high", date: "2026-10-02", notes: "" },
      { id: "task-2", title: "二", createdAt, completed: true, priority: "medium", date: "2026-10-02", notes: "" },
      { id: "task-3", title: "三", createdAt, completed: false, priority: "low", date: "2026-10-02", notes: "" },
    ],
    focusSessions: [],
  });

  assert.equal(stats.completionRate, 67);
});
