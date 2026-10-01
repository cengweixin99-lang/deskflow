import type { TimerMode } from "../../types";

export const FOCUS_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export interface TimerProgress {
  elapsedMilliseconds: number;
  runningSince: number | null;
}

export function getTimerDurationSeconds(mode: TimerMode) {
  return mode === "focus" ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS;
}

export function getElapsedMilliseconds(progress: TimerProgress, now: number) {
  const runningElapsed = progress.runningSince === null ? 0 : Math.max(0, now - progress.runningSince);
  return Math.max(0, progress.elapsedMilliseconds + runningElapsed);
}

export function getElapsedSeconds(progress: TimerProgress, now: number) {
  return Math.floor(getElapsedMilliseconds(progress, now) / 1000);
}

export function getRemainingSeconds(durationSeconds: number, progress: TimerProgress, now: number) {
  const remainingMilliseconds = durationSeconds * 1000 - getElapsedMilliseconds(progress, now);
  return Math.max(0, Math.ceil(remainingMilliseconds / 1000));
}

export function pauseTimerProgress(progress: TimerProgress, now: number): TimerProgress {
  return {
    elapsedMilliseconds: getElapsedMilliseconds(progress, now),
    runningSince: null,
  };
}

export function resumeTimerProgress(progress: TimerProgress, now: number): TimerProgress {
  return progress.runningSince === null ? { ...progress, runningSince: now } : progress;
}

export function formatTimerDuration(durationSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  if (!minutes) return `${seconds} 秒`;
  if (!seconds) return `${minutes} 分钟`;
  return `${minutes} 分 ${seconds} 秒`;
}
