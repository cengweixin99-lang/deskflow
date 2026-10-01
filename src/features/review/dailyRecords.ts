import type { DailyReflection, FocusSession, Task } from "../../types";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && getLocalDateKey(date) === value;
}

function getTimestampDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : getLocalDateKey(date);
}

export function isReviewDateAllowed(date: string, latestDate = getLocalDateKey()) {
  return isDateKey(date) && isDateKey(latestDate) && date <= latestDate;
}

export function shiftReviewDate(date: string, offset: number, latestDate = getLocalDateKey()) {
  if (!isReviewDateAllowed(date, latestDate)) return latestDate;
  const shifted = new Date(`${date}T12:00:00`);
  shifted.setDate(shifted.getDate() + offset);
  const shiftedDate = getLocalDateKey(shifted);
  return shiftedDate > latestDate ? latestDate : shiftedDate;
}

export function getDailyRecordOverview({
  date,
  tasks,
  focusSessions,
  dailyReflections,
}: {
  date: string;
  tasks: Task[];
  focusSessions: FocusSession[];
  dailyReflections: DailyReflection[];
}) {
  const dailyTasks = tasks.filter((task) => task.date === date);
  const focusSessionCount = focusSessions.filter((session) => getTimestampDateKey(session.startedAt) === date).length;
  const hasReflection = dailyReflections.some((reflection) => reflection.date === date);

  return {
    taskCount: dailyTasks.length,
    completedTaskCount: dailyTasks.filter((task) => task.completed).length,
    focusSessionCount,
    hasReflection,
    hasRecords: dailyTasks.length > 0 || focusSessionCount > 0 || hasReflection,
  };
}
