import assert from "node:assert/strict";
import test from "node:test";
import { createFocusSession, FOCUS_SESSION_NOTE_MAX_LENGTH, updateFocusSessionNote } from "../src/features/focus/sessions.ts";

const timer = {
  mode: "focus",
  taskId: "task-1",
  taskTitle: "整理项目记录",
  startedAt: "2026-10-01T08:00:00.000Z",
  elapsedMilliseconds: 0,
  runningSince: "2026-10-01T08:00:00.000Z",
};

test("focus completion preserves timer facts and records actual duration", () => {
  const completed = createFocusSession({
    id: "session-1",
    timer,
    endedAt: "2026-10-01T08:25:00.000Z",
    durationSeconds: 1_500,
    status: "completed",
  });
  const stopped = createFocusSession({
    id: "session-2",
    timer,
    endedAt: "2026-10-01T08:07:31.000Z",
    durationSeconds: 451.9,
    status: "stopped",
  });

  assert.deepEqual(completed, {
    id: "session-1",
    taskId: "task-1",
    taskTitle: "整理项目记录",
    startedAt: "2026-10-01T08:00:00.000Z",
    endedAt: "2026-10-01T08:25:00.000Z",
    durationSeconds: 1_500,
    status: "completed",
    note: "",
  });
  assert.equal(stopped.durationSeconds, 451);
  assert.equal(stopped.status, "stopped");
});

test("updating a focus note trims input, limits length, and preserves other sessions", () => {
  const sessions = [
    createFocusSession({ id: "session-1", timer, endedAt: "2026-10-01T08:25:00.000Z", durationSeconds: 1_500, status: "completed" }),
    createFocusSession({ id: "session-2", timer: { ...timer, taskId: null, taskTitle: "" }, endedAt: "2026-10-01T09:10:00.000Z", durationSeconds: 600, status: "stopped" }),
  ];
  const longNote = `  ${"完成复盘。".repeat(40)}  `;
  const updated = updateFocusSessionNote(sessions, "session-1", longNote);

  assert.equal(updated[0].note.length, FOCUS_SESSION_NOTE_MAX_LENGTH);
  assert.equal(updated[0].note.startsWith("完成复盘。"), true);
  assert.equal(updated[1], sessions[1]);
  assert.equal(sessions[0].note, "");
  assert.deepEqual(updateFocusSessionNote(sessions, "missing", "不会写入"), sessions);
});
