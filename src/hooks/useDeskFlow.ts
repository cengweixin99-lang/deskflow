import { useEffect, useMemo, useRef, useState } from "react";
import { discoverFeed, fetchParsedFeed, MAX_FEED_ARTICLES } from "../features/reader/feeds";
import { FOCUS_DURATION_SECONDS, formatTimerDuration, getElapsedSeconds, getRemainingSeconds, getTimerCompletionTime, getTimerDurationSeconds, getTimerProgress, pauseTimerProgress } from "../features/focus/timer";
import { createEmptyAppState, migrateAppState } from "../lib/state";
import { getDateKey } from "../types";
import type { ActiveTimerState, AppState, FeedArticle, FeedGroup, FeedSource, FocusSession, Task, TaskInput, TaskView, TimerMode } from "../types";

export function useDeskFlow() {
  const [state, setState] = useState<AppState>(createEmptyAppState);
  const [loaded, setLoaded] = useState(false);
  const [taskView, setTaskView] = useState<TaskView>("today");
  const [timerMode, setTimerMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_DURATION_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedFocusTaskId, setSelectedFocusTaskId] = useState("");
  const [timerRestored, setTimerRestored] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedsBusy, setFeedsBusy] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const completionHandledRef = useRef(false);
  const activeTimerWasPresentRef = useRef(false);
  const activeTimerContext = state.activeTimer;

  useEffect(() => {
    let cancelled = false;
    window.desktop.loadState()
      .then((saved) => {
        if (cancelled) return;
        const migratedState = migrateAppState(saved);
        const restoredTimer = migratedState.activeTimer;
        setState(migratedState);
        if (restoredTimer) {
          const remainingSeconds = getRemainingSeconds(getTimerDurationSeconds(restoredTimer.mode), getTimerProgress(restoredTimer), Date.now());
          setTimerMode(restoredTimer.mode);
          setSecondsLeft(remainingSeconds);
          setTimerRunning(restoredTimer.runningSince !== null || remainingSeconds === 0);
          setSelectedFocusTaskId(restoredTimer.taskId ?? "");
          setTimerRestored(true);
        }
        setLoaded(true);
      })
      .catch((error) => console.error("无法加载 DeskFlow 存档", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;
    const urgentSave = state.activeTimer !== null || activeTimerWasPresentRef.current;
    activeTimerWasPresentRef.current = state.activeTimer !== null;
    const timeout = window.setTimeout(() => {
      void window.desktop.saveState(state).catch((error) => console.error("无法保存 DeskFlow 存档", error));
    }, urgentSave ? 0 : 350);
    return () => window.clearTimeout(timeout);
  }, [state, loaded]);

  useEffect(() => {
    if (loaded && state.feeds.length) void refreshFeeds().catch(() => undefined);
  }, [loaded]);

  useEffect(() => {
    if (!timerRunning || !activeTimerContext?.runningSince) return undefined;
    function updateRemainingTime() {
      if (!activeTimerContext) return;
      setSecondsLeft(getRemainingSeconds(getTimerDurationSeconds(activeTimerContext.mode), getTimerProgress(activeTimerContext), Date.now()));
    }
    updateRemainingTime();
    const interval = window.setInterval(updateRemainingTime, 250);
    return () => window.clearInterval(interval);
  }, [activeTimerContext, timerRunning]);

  useEffect(() => {
    if (!timerRunning || secondsLeft !== 0 || !activeTimerContext || completionHandledRef.current) return;
    completionHandledRef.current = true;
    setTimerRunning(false);
    const completedMode = activeTimerContext.mode;
    const completionTime = getTimerCompletionTime(getTimerDurationSeconds(completedMode), getTimerProgress(activeTimerContext));
    const endedAt = new Date(completionTime ?? Date.now()).toISOString();
    if (activeTimerContext.mode === "focus") {
      const session: FocusSession = {
        id: crypto.randomUUID(),
        taskId: activeTimerContext.taskId,
        taskTitle: activeTimerContext.taskTitle,
        startedAt: activeTimerContext.startedAt,
        endedAt,
        durationSeconds: FOCUS_DURATION_SECONDS,
        status: "completed",
        note: "",
      };
      setState((currentState) => ({
        ...currentState,
        focusMinutes: currentState.focusMinutes + 25,
        focusSessions: [session, ...currentState.focusSessions],
        activeTimer: null,
      }));
    } else {
      setState((currentState) => ({ ...currentState, activeTimer: null }));
    }
    setTimerRestored(false);
    const nextMode = completedMode === "focus" ? "break" : "focus";
    setTimerMode(nextMode);
    setSecondsLeft(getTimerDurationSeconds(nextMode));
    window.desktop.showNotification({
      title: completedMode === "focus" ? "专注完成" : "休息结束",
      body: completedMode === "focus" ? "做得好，休息一下吧。" : "准备开始下一轮专注。",
    });
  }, [activeTimerContext, secondsLeft, timerRunning]);

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
  const focusTaskOptions = useMemo(
    () => state.tasks
      .filter((task) => !task.completed && task.date >= getDateKey())
      .sort((first, second) => first.date.localeCompare(second.date) || first.title.localeCompare(second.title, "zh-CN")),
    [state.tasks],
  );

  useEffect(() => {
    if (activeTimerContext?.mode === "focus" || !selectedFocusTaskId) return;
    if (!focusTaskOptions.some((task) => task.id === selectedFocusTaskId)) setSelectedFocusTaskId("");
  }, [activeTimerContext, focusTaskOptions, selectedFocusTaskId]);
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
    if (activeTimerContext) return;
    setTimerMode(mode);
    setTimerRunning(false);
    setSecondsLeft(getTimerDurationSeconds(mode));
    completionHandledRef.current = false;
  }

  function resetTimer() {
    if (activeTimerContext) return;
    setTimerRunning(false);
    setSecondsLeft(getTimerDurationSeconds(timerMode));
    completionHandledRef.current = false;
  }

  function selectFocusTask(taskId: string) {
    if (activeTimerContext?.mode === "focus") return;
    if (!taskId || focusTaskOptions.some((task) => task.id === taskId)) setSelectedFocusTaskId(taskId);
  }

  function toggleTimer() {
    if (timerRunning) {
      if (activeTimerContext) {
        const pausedProgress = pauseTimerProgress(getTimerProgress(activeTimerContext), Date.now());
        const pausedTimer: ActiveTimerState = {
          ...activeTimerContext,
          elapsedMilliseconds: pausedProgress.elapsedMilliseconds,
          runningSince: null,
        };
        setState((currentState) => ({ ...currentState, activeTimer: pausedTimer }));
        setSecondsLeft(getRemainingSeconds(getTimerDurationSeconds(pausedTimer.mode), pausedProgress, Date.now()));
      }
      setTimerRunning(false);
      setTimerRestored(false);
      return;
    }
    completionHandledRef.current = false;
    if (activeTimerContext) {
      setState((currentState) => ({
        ...currentState,
        activeTimer: currentState.activeTimer ? { ...currentState.activeTimer, runningSince: new Date().toISOString() } : null,
      }));
      setTimerRunning(true);
      setTimerRestored(false);
      return;
    }
    const startedAt = new Date();
    const task = timerMode === "focus" ? focusTaskOptions.find((item) => item.id === selectedFocusTaskId) : undefined;
    const activeTimer: ActiveTimerState = {
      mode: timerMode,
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? "",
      startedAt: startedAt.toISOString(),
      elapsedMilliseconds: 0,
      runningSince: startedAt.toISOString(),
    };
    setState((currentState) => ({ ...currentState, activeTimer }));
    setTimerRunning(true);
    setTimerRestored(false);
  }

  function stopTimer() {
    if (!activeTimerContext) return;
    completionHandledRef.current = true;
    const stoppedMode = activeTimerContext.mode;
    const durationSeconds = Math.min(
      getTimerDurationSeconds(stoppedMode),
      getElapsedSeconds(getTimerProgress(activeTimerContext), Date.now()),
    );
    if (stoppedMode === "focus") {
      const session: FocusSession = {
        id: crypto.randomUUID(),
        taskId: activeTimerContext.taskId,
        taskTitle: activeTimerContext.taskTitle,
        startedAt: activeTimerContext.startedAt,
        endedAt: new Date().toISOString(),
        durationSeconds,
        status: "stopped",
        note: "",
      };
      setState((currentState) => ({
        ...currentState,
        focusMinutes: currentState.focusMinutes + durationSeconds / 60,
        focusSessions: [session, ...currentState.focusSessions],
        activeTimer: null,
      }));
      window.desktop.showNotification({
        title: "本次专注已记录",
        body: activeTimerContext.taskTitle ? `已为“${activeTimerContext.taskTitle}”记录 ${formatTimerDuration(durationSeconds)}。` : `已记录 ${formatTimerDuration(durationSeconds)}。`,
      });
    } else {
      setState((currentState) => ({ ...currentState, activeTimer: null }));
      window.desktop.showNotification({ title: "休息已结束", body: "准备开始下一轮专注。" });
    }
    setTimerRunning(false);
    setTimerRestored(false);
    const nextMode = stoppedMode === "break" ? "focus" : stoppedMode;
    setTimerMode(nextMode);
    setSecondsLeft(getTimerDurationSeconds(nextMode));
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
    toggleTimer,
    stopTimer,
    resetTimer,
    focusTaskOptions,
    selectedFocusTaskId,
    selectFocusTask,
    timerSessionActive: activeTimerContext !== null,
    timerRestored,
    elapsedTimerSeconds: activeTimerContext ? getTimerDurationSeconds(activeTimerContext.mode) - secondsLeft : 0,
    focusSelectionLocked: activeTimerContext?.mode === "focus",
    activeFocusTaskId: activeTimerContext?.mode === "focus" ? activeTimerContext.taskId : null,
    activeFocusTaskTitle: activeTimerContext?.mode === "focus" ? activeTimerContext.taskTitle : "",
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
