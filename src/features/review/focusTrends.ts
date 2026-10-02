import type { FocusSession } from "../../types";

export type FocusTrendRange = "day" | "week" | "month";

export interface FocusTrendBucket {
  key: string;
  date: string;
  startHour: number | null;
  isFuture: boolean;
  durationSeconds: number;
  sessionCount: number;
}

export interface FocusTrend {
  range: FocusTrendRange;
  startDate: string;
  endDate: string;
  buckets: FocusTrendBucket[];
  totalDurationSeconds: number;
  sessionCount: number;
  activeBucketCount: number;
}

const DAY_BUCKET_HOURS = 4;

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || getLocalDateKey(date) !== value ? null : date;
}

function shiftDate(date: Date, offset: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + offset);
  return shifted;
}

function getRangeDates(selectedDate: Date, range: FocusTrendRange) {
  if (range === "day") return { start: selectedDate, end: selectedDate };

  if (range === "week") {
    const start = shiftDate(selectedDate, -((selectedDate.getDay() + 6) % 7));
    return { start, end: shiftDate(start, 6) };
  }

  const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12);
  return { start, end: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 12) };
}

function createDateBuckets(start: Date, end: Date, latestDate: Date): FocusTrendBucket[] {
  const buckets: FocusTrendBucket[] = [];
  for (let date = new Date(start); date <= end; date = shiftDate(date, 1)) {
    const dateKey = getLocalDateKey(date);
    buckets.push({
      key: dateKey,
      date: dateKey,
      startHour: null,
      isFuture: date > latestDate,
      durationSeconds: 0,
      sessionCount: 0,
    });
  }
  return buckets;
}

function createDayBuckets(date: Date): FocusTrendBucket[] {
  const dateKey = getLocalDateKey(date);
  return Array.from({ length: 24 / DAY_BUCKET_HOURS }, (_, index) => {
    const startHour = index * DAY_BUCKET_HOURS;
    return {
      key: `${dateKey}:${String(startHour).padStart(2, "0")}`,
      date: dateKey,
      startHour,
      isFuture: false,
      durationSeconds: 0,
      sessionCount: 0,
    };
  });
}

function isEndedSession(session: FocusSession) {
  return session.status === "completed" || session.status === "stopped";
}

export function getFocusTrend({
  selectedDate,
  latestDate,
  range,
  focusSessions,
}: {
  selectedDate: string;
  latestDate: string;
  range: FocusTrendRange;
  focusSessions: FocusSession[];
}): FocusTrend {
  const parsedSelectedDate = parseDateKey(selectedDate);
  const parsedLatestDate = parseDateKey(latestDate);
  const safeSelectedDate = parsedSelectedDate ?? parsedLatestDate ?? new Date(1970, 0, 1, 12);
  const safeLatestDate = parsedLatestDate && parsedLatestDate >= safeSelectedDate ? parsedLatestDate : safeSelectedDate;
  const { start, end } = getRangeDates(safeSelectedDate, range);
  const buckets = range === "day" ? createDayBuckets(safeSelectedDate) : createDateBuckets(start, end, safeLatestDate);
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  focusSessions.forEach((session) => {
    if (!isEndedSession(session) || !Number.isFinite(session.durationSeconds)) return;
    const startedAt = new Date(session.startedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    const sessionDate = getLocalDateKey(startedAt);
    const bucketKey = range === "day"
      ? `${sessionDate}:${String(Math.floor(startedAt.getHours() / DAY_BUCKET_HOURS) * DAY_BUCKET_HOURS).padStart(2, "0")}`
      : sessionDate;
    const bucket = bucketByKey.get(bucketKey);
    if (!bucket || bucket.isFuture) return;
    bucket.durationSeconds += Math.max(0, Math.floor(session.durationSeconds));
    bucket.sessionCount += 1;
  });

  return {
    range,
    startDate: getLocalDateKey(start),
    endDate: getLocalDateKey(end),
    buckets,
    totalDurationSeconds: buckets.reduce((total, bucket) => total + bucket.durationSeconds, 0),
    sessionCount: buckets.reduce((total, bucket) => total + bucket.sessionCount, 0),
    activeBucketCount: buckets.filter((bucket) => bucket.durationSeconds > 0).length,
  };
}
