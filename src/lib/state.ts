import { getDateKey } from "../types";
import type {
  AppState,
  DailyReflection,
  FeedArticle,
  FeedGroup,
  FeedSource,
  FocusSession,
  FocusSessionStatus,
  ReflectionScore,
  Task,
  TaskPriority,
} from "../types";

export const CURRENT_SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && getDateKey(date) === value;
}

function timestampValue(value: unknown, fallback: string | null = null): string | null {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function priorityValue(value: unknown): TaskPriority {
  return value === "high" || value === "low" || value === "medium" ? value : "medium";
}

function scoreValue(value: unknown): ReflectionScore | null {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
}

function normalizeTask(value: unknown, today: string): Task | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const title = nonEmptyString(value.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    completed: value.completed === true,
    priority: priorityValue(value.priority),
    date: isDateKey(value.date) ? value.date : today,
    notes: stringValue(value.notes),
  };
}

function normalizeGroup(value: unknown): FeedGroup | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const name = nonEmptyString(value.name);
  return id && name ? { id, name } : null;
}

function normalizeFeed(value: unknown, groupIds: Set<string>): FeedSource | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const title = nonEmptyString(value.title);
  const feedUrl = nonEmptyString(value.url);
  if (!id || !title || !feedUrl) return null;
  try {
    const url = new URL(feedUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  } catch {
    return null;
  }
  const groupId = nonEmptyString(value.groupId);
  return {
    id,
    title,
    url: feedUrl,
    siteUrl: stringValue(value.siteUrl),
    description: stringValue(value.description),
    groupId: groupId && groupIds.has(groupId) ? groupId : undefined,
    lastFetched: timestampValue(value.lastFetched),
    lastError: typeof value.lastError === "string" ? value.lastError : null,
  };
}

function normalizeArticle(value: unknown, feedIds: Set<string>): FeedArticle | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const feedId = nonEmptyString(value.feedId);
  const title = nonEmptyString(value.title);
  const link = nonEmptyString(value.link);
  if (!id || !feedId || !feedIds.has(feedId) || !title || !link) return null;
  return {
    id,
    feedId,
    title,
    link,
    excerpt: stringValue(value.excerpt),
    author: stringValue(value.author),
    publishedAt: stringValue(value.publishedAt),
    read: value.read === true,
    saved: value.saved === true,
  };
}

function sessionStatusValue(value: unknown): FocusSessionStatus {
  if (value === "active" || value === "completed" || value === "stopped") return value;
  return "stopped";
}

function normalizeFocusSession(value: unknown, tasksById: Map<string, Task>): FocusSession | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const startedAt = timestampValue(value.startedAt);
  if (!id || !startedAt) return null;
  const taskIdValue = nonEmptyString(value.taskId);
  const taskId = taskIdValue ?? null;
  const durationSeconds = typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds)
    ? Math.max(0, Math.floor(value.durationSeconds))
    : 0;
  return {
    id,
    taskId,
    taskTitle: stringValue(value.taskTitle, taskId ? tasksById.get(taskId)?.title ?? "" : ""),
    startedAt,
    endedAt: timestampValue(value.endedAt),
    durationSeconds,
    status: sessionStatusValue(value.status),
    note: stringValue(value.note),
  };
}

function normalizeReflection(value: unknown): DailyReflection | null {
  if (!isRecord(value) || !isDateKey(value.date)) return null;
  return {
    date: value.date,
    summary: stringValue(value.summary),
    energy: scoreValue(value.energy),
    satisfaction: scoreValue(value.satisfaction),
    updatedAt: timestampValue(value.updatedAt, new Date(`${value.date}T00:00:00`).toISOString())!,
  };
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function migrateToCurrentSchema(saved: Record<string, unknown>): Record<string, unknown> {
  const version = Number.isInteger(saved.schemaVersion) && Number(saved.schemaVersion) >= 0
    ? Number(saved.schemaVersion)
    : 0;
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`存档版本 ${version} 高于当前支持的版本 ${CURRENT_SCHEMA_VERSION}`);
  }
  if (version === 0) {
    return {
      ...saved,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      focusSessions: [],
      dailyReflections: [],
    };
  }
  return saved;
}

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    focusMinutes: 0,
    feeds: [],
    groups: [],
    articles: [],
    focusSessions: [],
    dailyReflections: [],
  };
}

export function migrateAppState(value: unknown): AppState {
  const saved = migrateToCurrentSchema(isRecord(value) ? value : {});
  const today = getDateKey();
  const tasks = arrayValue(saved.tasks).map((task) => normalizeTask(task, today)).filter((task): task is Task => task !== null);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const groups = arrayValue(saved.groups).map(normalizeGroup).filter((group): group is FeedGroup => group !== null);
  const groupIds = new Set(groups.map((group) => group.id));
  const feeds = arrayValue(saved.feeds).map((feed) => normalizeFeed(feed, groupIds)).filter((feed): feed is FeedSource => feed !== null);
  const feedIds = new Set(feeds.map((feed) => feed.id));
  const reflectionsByDate = new Map<string, DailyReflection>();
  for (const value of arrayValue(saved.dailyReflections)) {
    const reflection = normalizeReflection(value);
    if (reflection) reflectionsByDate.set(reflection.date, reflection);
  }
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks,
    focusMinutes: typeof saved.focusMinutes === "number" && Number.isFinite(saved.focusMinutes)
      ? Math.max(0, saved.focusMinutes)
      : 0,
    feeds,
    groups,
    articles: arrayValue(saved.articles).map((article) => normalizeArticle(article, feedIds)).filter((article): article is FeedArticle => article !== null),
    focusSessions: arrayValue(saved.focusSessions).map((session) => normalizeFocusSession(session, tasksById)).filter((session): session is FocusSession => session !== null),
    dailyReflections: [...reflectionsByDate.values()],
  };
}
