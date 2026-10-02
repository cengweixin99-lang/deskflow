import type { DailyReflection, ReflectionScore } from "../../types";

export const DAILY_REFLECTION_SUMMARY_MAX_LENGTH = 1000;

export interface DailyReflectionInput {
  date: string;
  summary: string;
  energy: ReflectionScore | null;
  satisfaction: ReflectionScore | null;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isReflectionDateAllowed(value: string, latestDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !/^\d{4}-\d{2}-\d{2}$/.test(latestDate)) return false;
  const date = new Date(`${value}T12:00:00`);
  const latest = new Date(`${latestDate}T12:00:00`);
  return !Number.isNaN(date.getTime())
    && !Number.isNaN(latest.getTime())
    && getLocalDateKey(date) === value
    && getLocalDateKey(latest) === latestDate
    && value <= latestDate;
}

function isReflectionScore(value: unknown): value is ReflectionScore | null {
  return value === null || value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function createDailyReflection(
  input: DailyReflectionInput,
  updatedAt = new Date().toISOString(),
  latestDate = getLocalDateKey(),
): DailyReflection | null {
  const summary = input.summary.trim();
  if (
    !isReflectionDateAllowed(input.date, latestDate)
    || !isReflectionScore(input.energy)
    || !isReflectionScore(input.satisfaction)
    || summary.length > DAILY_REFLECTION_SUMMARY_MAX_LENGTH
    || (!summary && input.energy === null && input.satisfaction === null)
    || Number.isNaN(Date.parse(updatedAt))
  ) return null;

  return {
    date: input.date,
    summary,
    energy: input.energy,
    satisfaction: input.satisfaction,
    updatedAt,
  };
}

export function replaceDailyReflection(
  reflections: DailyReflection[],
  reflection: DailyReflection,
) {
  return [reflection, ...reflections.filter((item) => item.date !== reflection.date)];
}

export function restoreDailyReflection(
  reflections: DailyReflection[],
  date: string,
  previous: DailyReflection | null,
) {
  const remaining = reflections.filter((reflection) => reflection.date !== date);
  if (!previous || previous.date !== date) return remaining;
  return [previous, ...remaining];
}
