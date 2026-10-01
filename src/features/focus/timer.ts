import type { ActiveTimerState, TimerMode } from "../../types";

export const FOCUS_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export interface TimerProgress {
  elapsedMilliseconds: number;
  runningSince: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestampValue(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
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

export function getTimerProgress(timer: ActiveTimerState): TimerProgress {
  return {
    elapsedMilliseconds: timer.elapsedMilliseconds,
    runningSince: timer.runningSince ? Date.parse(timer.runningSince) : null,
  };
}

export function getTimerCompletionTime(durationSeconds: number, progress: TimerProgress) {
  if (progress.runningSince === null) return null;
  const remainingMilliseconds = Math.max(0, durationSeconds * 1000 - progress.elapsedMilliseconds);
  return progress.runningSince + remainingMilliseconds;
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

export function normalizeActiveTimer(value: unknown, now = Date.now()): ActiveTimerState | null {
  if (!isRecord(value) || (value.mode !== "focus" && value.mode !== "break")) return null;
  const startedAt = timestampValue(value.startedAt);
  const runningSince = value.runningSince === null ? null : timestampValue(value.runningSince);
  if (!startedAt || typeof value.elapsedMilliseconds !== "number" || !Number.isFinite(value.elapsedMilliseconds) || value.elapsedMilliseconds < 0) return null;
  if (value.runningSince !== null && runningSince === null) return null;
  const durationMilliseconds = getTimerDurationSeconds(value.mode) * 1000;
  const startedAtMilliseconds = Math.min(now, Date.parse(startedAt));
  const runningSinceMilliseconds = runningSince === null
    ? null
    : Math.min(now, Math.max(startedAtMilliseconds, Date.parse(runningSince)));
  return {
    mode: value.mode,
    taskId: typeof value.taskId === "string" && value.taskId.trim() ? value.taskId : null,
    taskTitle: typeof value.taskTitle === "string" ? value.taskTitle : "",
    startedAt: new Date(startedAtMilliseconds).toISOString(),
    elapsedMilliseconds: Math.min(durationMilliseconds, Math.floor(value.elapsedMilliseconds)),
    runningSince: runningSinceMilliseconds === null ? null : new Date(runningSinceMilliseconds).toISOString(),
  };
}
