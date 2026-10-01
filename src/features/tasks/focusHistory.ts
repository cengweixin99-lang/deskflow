import type { FocusSession } from "../../types";

export interface TaskFocusSummary {
  sessions: FocusSession[];
  totalDurationSeconds: number;
}

function sessionTimestamp(session: FocusSession) {
  const timestamp = Date.parse(session.endedAt ?? session.startedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getTaskFocusSummary(focusSessions: FocusSession[], taskId: string): TaskFocusSummary {
  const sessions = focusSessions
    .filter((session) => session.taskId === taskId)
    .slice()
    .sort((first, second) => sessionTimestamp(second) - sessionTimestamp(first));

  return {
    sessions,
    totalDurationSeconds: sessions.reduce((total, session) => total + Math.max(0, session.durationSeconds), 0),
  };
}
