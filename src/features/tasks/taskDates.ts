import type { Task } from "../../types";

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && getLocalDateKey(date) === value;
}

export function getTaskEarliestDate(task: Pick<Task, "createdAt" | "date">) {
  const createdAt = new Date(task.createdAt);
  return Number.isNaN(createdAt.getTime()) ? task.date : getLocalDateKey(createdAt);
}

export function canScheduleTaskOn(task: Pick<Task, "createdAt" | "date">, date: string) {
  return isDateKey(date) && date >= getTaskEarliestDate(task);
}
