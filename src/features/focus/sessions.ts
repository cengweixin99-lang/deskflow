import type { ActiveTimerState, FocusSession, FocusSessionStatus } from "../../types";

export const FOCUS_SESSION_NOTE_MAX_LENGTH = 160;

interface CreateFocusSessionInput {
  id: string;
  timer: ActiveTimerState;
  endedAt: string;
  durationSeconds: number;
  status: Extract<FocusSessionStatus, "completed" | "stopped">;
}

export function createFocusSession({ id, timer, endedAt, durationSeconds, status }: CreateFocusSessionInput): FocusSession {
  return {
    id,
    taskId: timer.taskId,
    taskTitle: timer.taskTitle,
    startedAt: timer.startedAt,
    endedAt,
    durationSeconds: Math.max(0, Math.floor(durationSeconds)),
    status,
    note: "",
  };
}

export function updateFocusSessionNote(sessions: FocusSession[], sessionId: string, note: string) {
  const normalizedNote = note.trim().slice(0, FOCUS_SESSION_NOTE_MAX_LENGTH);
  return sessions.map((session) => session.id === sessionId ? { ...session, note: normalizedNote } : session);
}
