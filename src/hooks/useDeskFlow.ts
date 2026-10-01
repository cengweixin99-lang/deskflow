import { useEffect, useMemo, useState } from "react";
import { discoverFeed, fetchParsedFeed, MAX_FEED_ARTICLES } from "../features/reader/feeds";
import { createEmptyAppState, migrateAppState } from "../lib/state";
import { getDateKey } from "../types";
import type { AppState, FeedArticle, FeedGroup, FeedSource, Task, TaskInput, TaskView, TimerMode } from "../types";

export function useDeskFlow() {
  const [state, setState] = useState<AppState>(createEmptyAppState);
  const [loaded, setLoaded] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>("today");
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedsBusy, setFeedsBusy] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.desktop.loadState()
      .then((saved) => {
        if (cancelled) return;
        setState(migrateAppState(saved));
        setLoaded(true);
      })
      .catch((error) => console.error("无法加载 DeskFlow 存档", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    const timeout = window.setTimeout(() => {
      void window.desktop.saveState(state).catch((error) => console.error("无法保存 DeskFlow 存档", error));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [state, loaded]);

  useEffect(() => {
    if (loaded && state.feeds.length) void refreshFeeds().catch(() => undefined);
  }, [loaded]);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          if (timerMode === "focus") {
            setState((currentState) => ({
              ...currentState,
              focusMinutes: currentState.focusMinutes + 25,
            }));
          }
          window.desktop.showNotification({
            title: "专注完成",
            body:
              timerMode === "focus"
                ? "做得好，休息一下吧。"
                : "休息结束，准备开始下一轮。",
          });
          return timerMode === "focus" ? 5 * 60 : 25 * 60;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning, timerMode]);

  const todayTasks = useMemo(
    () => state.tasks.filter((task) => task.date === getDateKey()),
    [state.tasks],
  );
  const upcomingTasks = useMemo(
    () => state.tasks
      .filter((task) => task.date > getDateKey() && !task.completed)
      .sort((first, second) => first.date.localeCompare(second.date)),
    [state.tasks],
  );
  const completedTasks = useMemo(
    () => state.tasks
      .filter((task) => task.completed)
      .sort((first, second) => second.date.localeCompare(first.date)),
    [state.tasks],
  );
  const visibleTasks = useMemo(() => {
    if (taskView === "upcoming") return upcomingTasks;
    if (taskView === "completed") return completedTasks;
    return todayTasks;
  }, [completedTasks, taskView, todayTasks, upcomingTasks]);
  const taskViewCounts: Record<TaskView, number> = {
    today: todayTasks.length,
    upcoming: upcomingTasks.length,
    completed: completedTasks.length,
  };

  const completedToday = todayTasks.filter((task) => task.completed).length;
  const progress = todayTasks.length
    ? Math.round((completedToday / todayTasks.length) * 100)
    : 0;

  function addTask(input: TaskInput): Task | null {
    const title = input.title.trim();
    const today = getDateKey();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < today) return null;
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      priority: input.priority,
      date: input.date,
      notes: input.notes.trim(),
    };
    setState((current) => ({
      ...current,
      tasks: [task, ...current.tasks],
    }));
    return task;
  }

  function toggleTask(id: string) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    }));
  }

  function deleteTask(id: string) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }));
  }

  function updateTask(id: string, input: TaskInput) {
    const title = input.title.trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? {
          ...task,
          title,
          priority: input.priority,
          date: input.date,
          notes: input.notes.trim(),
        } : task,
      ),
    }));
  }

  async function subscribeFeed(input: string) {
    setSubscribing(true);
    try {
      const discovered = await discoverFeed(input);
      const existing = state.feeds.find((feed) => feed.url === discovered.url);
      if (existing) {
        await refreshFeed(existing);
        return existing.id;
      }

      const source: FeedSource = {
        id: crypto.randomUUID(),
        title: discovered.title,
        url: discovered.url,
        siteUrl: discovered.siteUrl,
        description: discovered.description,
        groupId: undefined,
        lastFetched: null,
        lastError: null,
      };
      setState((current) => ({ ...current, feeds: [source, ...current.feeds] }));
      try {
        await refreshFeed(source);
      } catch (error) {
        setState((current) => ({
          ...current,
          feeds: current.feeds.filter((feed) => feed.id !== source.id),
          articles: current.articles.filter((article) => article.feedId !== source.id),
        }));
        throw error;
      }
      return source.id;
    } finally {
      setSubscribing(false);
    }
  }

  async function refreshFeed(source: FeedSource) {
    try {
      const parsed = await fetchParsedFeed(source);
      const fetchedAt = new Date().toISOString();
      setState((current) => {
        const existing = new Map(current.articles.map((article) => [article.id, article]));
        const incoming = parsed.articles.slice(0, MAX_FEED_ARTICLES).map((article) => ({
          ...article,
          read: existing.get(article.id)?.read ?? false,
          saved: existing.get(article.id)?.saved ?? false,
        }));
        const incomingIds = new Set(incoming.map((article) => article.id));
        const older = current.articles.filter((article) => article.feedId === source.id && !incomingIds.has(article.id));
        return {
          ...current,
          feeds: current.feeds.map((feed) => feed.id === source.id ? {
            ...feed,
            title: parsed.title,
            siteUrl: parsed.siteUrl,
            description: parsed.description,
            lastFetched: fetchedAt,
            lastError: null,
          } : feed),
          articles: [...incoming, ...older, ...current.articles.filter((article) => article.feedId !== source.id)],
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        feeds: current.feeds.map((feed) => feed.id === source.id
          ? { ...feed, lastError: error instanceof Error ? error.message : "订阅刷新失败" }
          : feed),
      }));
      throw error;
    }
  }

  async function refreshFeeds(feedId?: string) {
    const targets = feedId
      ? state.feeds.filter((feed) => feed.id === feedId)
      : state.feeds;
    if (!targets.length) return;
    setFeedsBusy(true);
    try {
      const results = await Promise.allSettled(targets.map((feed) => refreshFeed(feed)));
      const failures = results.flatMap((result, index) => result.status === "rejected"
        ? [`${targets[index].title}：${result.reason instanceof Error ? result.reason.message : "订阅刷新失败"}`]
        : []);
      if (failures.length) throw new Error(failures.join("；"));
    } finally {
      setFeedsBusy(false);
    }
  }

  function removeFeed(id: string) {
    setState((current) => ({
      ...current,
      feeds: current.feeds.filter((feed) => feed.id !== id),
      articles: current.articles.filter((article) => article.feedId !== id),
    }));
  }

  function addFeedGroup(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return "";
    const group: FeedGroup = { id: crypto.randomUUID(), name: trimmed };
    setState((current) => ({ ...current, groups: [group, ...current.groups] }));
    return group.id;
  }

  function renameFeedGroup(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === id ? { ...group, name: trimmed } : group),
    }));
  }

  function removeFeedGroup(id: string) {
    setState((current) => ({
      ...current,
      groups: current.groups.filter((group) => group.id !== id),
      feeds: current.feeds.map((feed) => feed.groupId === id ? { ...feed, groupId: undefined } : feed),
    }));
  }

  function setFeedGroup(feedId: string, groupId: string | null) {
    setState((current) => ({
      ...current,
      feeds: current.feeds.map((feed) => feed.id === feedId ? { ...feed, groupId: groupId || undefined } : feed),
    }));
  }

  function updateArticle(id: string, patch: Partial<Pick<FeedArticle, "read" | "saved">>) {
    setState((current) => ({
      ...current,
      articles: current.articles.map((article) => article.id === id ? { ...article, ...patch } : article),
    }));
  }

  function setMode(mode: TimerMode) {
    setTimerMode(mode);
    setTimerRunning(false);
    setSecondsLeft(mode === "focus" ? 25 * 60 : 5 * 60);
  }

  function resetTimer() {
    setTimerRunning(false);
    setSecondsLeft(timerMode === "focus" ? 25 * 60 : 5 * 60);
  }

  return {
    state,
    taskView,
    setTaskView,
    taskViewCounts,
    timerMode,
    setMode,
    secondsLeft,
    timerRunning,
    setTimerRunning,
    resetTimer,
    sidebarCollapsed,
    setSidebarCollapsed,
    visibleTasks,
    progress,
    addTask,
    toggleTask,
    deleteTask,
    updateTask,
    subscribeFeed,
    refreshFeeds,
    removeFeed,
    addFeedGroup,
    renameFeedGroup,
    removeFeedGroup,
    setFeedGroup,
    updateArticle,
    feedsBusy,
    subscribing,
  };
}
