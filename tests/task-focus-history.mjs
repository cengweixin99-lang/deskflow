import assert from "node:assert/strict";
import test from "node:test";
import { getTaskFocusSummary } from "../src/features/tasks/focusHistory.ts";

const sessions = [
  {
    id: "session-old",
    taskId: "task-1",
    taskTitle: "整理项目记录",
    startedAt: "2026-10-01T08:00:00.000Z",
    endedAt: "2026-10-01T08:25:00.000Z",
    durationSeconds: 1_500,
    status: "completed",
    note: "完成第一轮整理",
  },
  {
    id: "session-other-task",
    taskId: "task-2",
    taskTitle: "阅读资料",
    startedAt: "2026-10-01T09:00:00.000Z",
    endedAt: "2026-10-01T09:10:00.000Z",
    durationSeconds: 600,
    status: "stopped",
    note: "",
  },
  {
    id: "session-latest",
    taskId: "task-1",
    taskTitle: "整理项目记录",
    startedAt: "2026-10-01T10:00:00.000Z",
    endedAt: "2026-10-01T10:07:35.000Z",
    durationSeconds: 455,
    status: "stopped",
    note: "记录下一步",
  },
  {
    id: "session-unlinked",
    taskId: null,
    taskTitle: "",
    startedAt: "2026-10-01T11:00:00.000Z",
    endedAt: "2026-10-01T11:25:00.000Z",
    durationSeconds: 1_500,
    status: "completed",
    note: "",
  },
];

test("task focus summary filters by stable task id, totals duration, and sorts latest first", () => {
  const originalOrder = sessions.map((session) => session.id);
  const summary = getTaskFocusSummary(sessions, "task-1");

  assert.equal(summary.totalDurationSeconds, 1_955);
  assert.deepEqual(summary.sessions.map((session) => session.id), ["session-latest", "session-old"]);
  assert.deepEqual(sessions.map((session) => session.id), originalOrder);
});

test("task focus summary returns a safe empty result when no sessions are linked", () => {
  assert.deepEqual(getTaskFocusSummary(sessions, "missing-task"), {
    sessions: [],
    totalDurationSeconds: 0,
  });
});
