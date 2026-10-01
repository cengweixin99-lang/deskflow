import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTimerDuration,
  getElapsedMilliseconds,
  getElapsedSeconds,
  getRemainingSeconds,
  getTimerCompletionTime,
  getTimerProgress,
  normalizeActiveTimer,
  pauseTimerProgress,
  resumeTimerProgress,
} from "../src/features/focus/timer.ts";

test("running progress is derived from timestamps", () => {
  const progress = { elapsedMilliseconds: 0, runningSince: 1_000 };
  assert.equal(getElapsedMilliseconds(progress, 3_500), 2_500);
  assert.equal(getElapsedSeconds(progress, 3_500), 2);
  assert.equal(getRemainingSeconds(25, progress, 3_500), 23);
});

test("paused time is excluded after pause and resume", () => {
  const paused = pauseTimerProgress({ elapsedMilliseconds: 500, runningSince: 1_000 }, 3_500);
  assert.deepEqual(paused, { elapsedMilliseconds: 3_000, runningSince: null });
  assert.equal(getElapsedMilliseconds(paused, 10_000), 3_000);

  const resumed = resumeTimerProgress(paused, 10_000);
  assert.equal(getElapsedMilliseconds(resumed, 11_500), 4_500);
  assert.equal(getRemainingSeconds(25, resumed, 11_500), 21);
});

test("a delayed update still reaches natural completion", () => {
  const progress = { elapsedMilliseconds: 0, runningSince: 1_000 };
  assert.equal(getRemainingSeconds(25, progress, 27_000), 0);
  assert.equal(getTimerCompletionTime(25, progress), 26_000);
});

test("duration labels stay concise", () => {
  assert.equal(formatTimerDuration(0), "0 秒");
  assert.equal(formatTimerDuration(60), "1 分钟");
  assert.equal(formatTimerDuration(65), "1 分 5 秒");
  assert.equal(formatTimerDuration(13_820), "3 小时 50 分 20 秒");
});

test("persisted timers are normalized without losing task snapshots", () => {
  const timer = normalizeActiveTimer({
    mode: "focus",
    taskId: "deleted-task",
    taskTitle: "开始时的任务标题",
    startedAt: "2026-10-01T08:00:00.000Z",
    elapsedMilliseconds: 12_500,
    runningSince: "2026-10-01T08:01:00.000Z",
  }, Date.parse("2026-10-01T08:02:00.000Z"));
  assert.deepEqual(timer, {
    mode: "focus",
    taskId: "deleted-task",
    taskTitle: "开始时的任务标题",
    startedAt: "2026-10-01T08:00:00.000Z",
    elapsedMilliseconds: 12_500,
    runningSince: "2026-10-01T08:01:00.000Z",
  });
  assert.deepEqual(getTimerProgress(timer), { elapsedMilliseconds: 12_500, runningSince: Date.parse("2026-10-01T08:01:00.000Z") });
});

test("invalid persisted timers are discarded and future running timestamps are clamped", () => {
  assert.equal(normalizeActiveTimer({ mode: "focus" }), null);
  const now = Date.parse("2026-10-01T08:02:00.000Z");
  const timer = normalizeActiveTimer({
    mode: "break",
    taskId: null,
    taskTitle: "",
    startedAt: "2026-10-01T08:00:00.000Z",
    elapsedMilliseconds: 999_999,
    runningSince: "2026-10-01T09:00:00.000Z",
  }, now);
  assert.equal(timer?.elapsedMilliseconds, 5 * 60 * 1000);
  assert.equal(timer?.startedAt, "2026-10-01T08:00:00.000Z");
  assert.equal(timer?.runningSince, "2026-10-01T08:02:00.000Z");

  const futureTimer = normalizeActiveTimer({
    mode: "focus",
    taskId: null,
    taskTitle: "",
    startedAt: "2026-10-01T09:00:00.000Z",
    elapsedMilliseconds: 0,
    runningSince: null,
  }, now);
  assert.equal(futureTimer?.startedAt, "2026-10-01T08:02:00.000Z");
});
