import { getDateKey } from "../types";
import { normalizeActiveTimer } from "../features/focus/timer";
import type {
  AppState,
  DailyReflection,
  FeedArticle,
  FeedGroup,
  FeedSource,
  FocusSession,
  FocusSessionStatus,
  ReadingAction,
  ReflectionScore,
  Task,
  TaskPriority,
} from "../types";

export const CURRENT_SCHEMA_VERSION = 4;

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
  const date = isDateKey(value.date) ? value.date : today;
  const fallbackCreatedAt = new Date(`${date}T00:00:00`).toISOString();
  const savedCreatedAt = timestampValue(value.createdAt, fallbackCreatedAt)!;
  const createdAt = getDateKey(new Date(savedCreatedAt)) <= date ? savedCreatedAt : fallbackCreatedAt;
  return {
    id,
    title,
    createdAt,
    completed: value.completed === true,
    priority: priorityValue(value.priority),
    date,
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

function normalizeReadingAction(value: unknown): ReadingAction | null {
  if (!isRecord(value)) return null;
  const id = nonEmptyString(value.id);
  const articleId = nonEmptyString(value.articleId);
  const articleTitle = nonEmptyString(value.articleTitle);
  const openedAt = timestampValue(value.openedAt);
  if (!id || !articleId || !articleTitle || !openedAt) return null;
  return {
    id,
    articleId,
    articleTitle,
    articleLink: stringValue(value.articleLink),
    feedId: stringValue(value.feedId),
    feedTitle: stringValue(value.feedTitle),
    openedAt,
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
  let migrated = saved;
  if (version === 0) {
    migrated = {
      ...saved,
      schemaVersion: 1,
      focusSessions: [],
      dailyReflections: [],
    };
  }
  if (version <= 1) {
    migrated = {
      ...migrated,
      schemaVersion: 2,
      activeTimer: null,
    };
  }
  if (version <= 2) migrated = { ...migrated, schemaVersion: 3 };
  if (version <= 3) migrated = { ...migrated, schemaVersion: CURRENT_SCHEMA_VERSION, readingActions: [] };
  return migrated;
}

export function createEmptyAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks: [],
    focusMinutes: 0,
    feeds: [],
    groups: [],
    articles: [],
    readingActions: [],
    focusSessions: [],
    activeTimer: null,
    dailyReflections: [],
  };
}

export function migrateAppState(value: unknown): AppState {
  const saved = migrateToCurrentSchema(isRecord(value) ? value : {});
  const today = getDateKey();
  const tasks = arrayValue(saved.tasks).map((task) => normalizeTask(task, today)).filter((task): task is Task => task !== null);
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const normalizedTimer = normalizeActiveTimer(saved.activeTimer);
  const activeTimer = normalizedTimer && !normalizedTimer.taskTitle && normalizedTimer.taskId
    ? { ...normalizedTimer, taskTitle: tasksById.get(normalizedTimer.taskId)?.title ?? "" }
    : normalizedTimer;
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
    readingActions: arrayValue(saved.readingActions).map(normalizeReadingAction).filter((action): action is ReadingAction => action !== null),
    focusSessions: arrayValue(saved.focusSessions).map((session) => normalizeFocusSession(session, tasksById)).filter((session): session is FocusSession => session !== null),
    activeTimer,
    dailyReflections: [...reflectionsByDate.values()],
  };
}
