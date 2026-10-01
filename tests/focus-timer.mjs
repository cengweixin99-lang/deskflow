import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTimerDuration,
  getElapsedMilliseconds,
  getElapsedSeconds,
  getRemainingSeconds,
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
});

test("duration labels stay concise", () => {
  assert.equal(formatTimerDuration(0), "0 秒");
  assert.equal(formatTimerDuration(60), "1 分钟");
  assert.equal(formatTimerDuration(65), "1 分 5 秒");
});
