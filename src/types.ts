export type TaskPriority = "high" | "medium" | "low";
export type TaskFilter = "all" | "pending" | "completed";
export type TimerMode = "focus" | "break";
export type FocusFilter = "all" | "latest" | "saved";
export type FocusSessionStatus = "active" | "completed" | "stopped";
export type ReflectionScore = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  date: string;
  notes: string;
}

export interface FeedSource {
  id: string;
  title: string;
  url: string;
  siteUrl: string;
  description: string;
  groupId?: string;
  lastFetched: string | null;
  lastError: string | null;
}

export interface FeedGroup {
  id: string;
  name: string;
}

export interface FeedArticle {
  id: string;
  feedId: string;
  title: string;
  link: string;
  excerpt: string;
  author: string;
  publishedAt: string;
  read: boolean;
  saved: boolean;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  taskTitle: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  status: FocusSessionStatus;
  note: string;
}

export interface DailyReflection {
  date: string;
  summary: string;
  energy: ReflectionScore | null;
  satisfaction: ReflectionScore | null;
  updatedAt: string;
}

export interface FetchedText {
  url: string;
  contentType: string;
  text: string;
}

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppState {
  schemaVersion: number;
  tasks: Task[];
  focusMinutes: number;
  feeds: FeedSource[];
  groups: FeedGroup[];
  articles: FeedArticle[];
  focusSessions: FocusSession[];
  dailyReflections: DailyReflection[];
}

export function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
