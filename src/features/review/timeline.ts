import type { FocusSession, ReadingAction, Task } from "../../types";

export type DailyTimelineItem =
  | { id: string; kind: "task"; occurredAt: null; task: Task }
  | { id: string; kind: "focus"; occurredAt: string; session: FocusSession }
  | { id: string; kind: "reading"; occurredAt: string; action: ReadingAction };

function getLocalDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyTimelineItems({
  date,
  tasks,
  focusSessions,
  readingActions,
}: {
  date: string;
  tasks: Task[];
  focusSessions: FocusSession[];
  readingActions: ReadingAction[];
}): DailyTimelineItem[] {
  const plannedTasks: DailyTimelineItem[] = tasks
    .filter((task) => task.date === date)
    .map((task) => ({ id: `task:${task.id}`, kind: "task", occurredAt: null, task }));
  const timedActions: DailyTimelineItem[] = [
    ...focusSessions
      .filter((session) => getLocalDateKey(session.startedAt) === date)
      .map((session): DailyTimelineItem => ({ id: `focus:${session.id}`, kind: "focus", occurredAt: session.startedAt, session })),
    ...readingActions
      .filter((action) => getLocalDateKey(action.openedAt) === date)
      .map((action): DailyTimelineItem => ({ id: `reading:${action.id}`, kind: "reading", occurredAt: action.openedAt, action })),
  ].sort((left, right) => Date.parse(left.occurredAt ?? "") - Date.parse(right.occurredAt ?? ""));

  return [...plannedTasks, ...timedActions];
}
