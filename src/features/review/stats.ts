import type { FocusSession, Task } from "../../types";

function getLocalDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyStats({
  date,
  tasks,
  focusSessions,
}: {
  date: string;
  tasks: Task[];
  focusSessions: FocusSession[];
}) {
  const dailyTasks = tasks.filter((task) => task.date === date);
  const completedTaskCount = dailyTasks.filter((task) => task.completed).length;
  const endedFocusSessions = focusSessions.filter((session) => (
    getLocalDateKey(session.startedAt) === date
    && (session.status === "completed" || session.status === "stopped")
  ));

  return {
    taskCount: dailyTasks.length,
    completedTaskCount,
    completionRate: dailyTasks.length === 0 ? null : Math.round((completedTaskCount / dailyTasks.length) * 100),
    focusSessionCount: endedFocusSessions.length,
    focusDurationSeconds: endedFocusSessions.reduce((total, session) => total + Math.max(0, session.durationSeconds), 0),
    stoppedFocusCount: endedFocusSessions.filter((session) => session.status === "stopped").length,
  };
}
