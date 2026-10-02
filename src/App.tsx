import { CalendarCheck2, CheckCircle2, NotebookPen, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";
import { FocusCompletionModal } from "./features/focus/FocusCompletionModal";
import { FocusCard } from "./features/focus/FocusCard";
import { StopFocusModal } from "./features/focus/StopFocusModal";
import { CalendarCard } from "./features/tasks/CalendarCard";
import { Sidebar, type AppSection } from "./components/Sidebar";
import { WindowControls } from "./components/WindowControls";
import { TaskSection } from "./features/tasks/TaskSection";
import { TaskEditorModal } from "./features/tasks/TaskEditorModal";
import { FocusReader } from "./features/reader/FocusReader";
import { ReviewPage } from "./features/review/ReviewPage";
import { isReviewDateAllowed } from "./features/review/dailyRecords";
import type { DailyReflectionInput } from "./features/review/reflections";
import { formatDateLabel, getDateKey } from "./types";
import type { DailyReflection, Task, TaskInput } from "./types";
import { useDeskFlow } from "./hooks/useDeskFlow";
import { useWindowModalActive } from "./hooks/useWindowModalState";

export function App() {
  const deskFlow = useDeskFlow();
  const windowModalActive = useWindowModalActive();
  const { state, taskView, visibleTasks, sidebarCollapsed } = deskFlow;
  const [taskEditor, setTaskEditor] = useState<{ mode: "create"; initialDate: string } | { mode: "edit"; task: Task } | null>(null);
  const [taskNotice, setTaskNotice] = useState<{
    kind: "created" | "moved" | "completed" | "reopened";
    taskId: string;
    title: string;
    targetDate: string;
    previousDate?: string;
    input: TaskInput;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<AppSection>("tasks");
  const [reviewDate, setReviewDate] = useState(getDateKey);
  const [stopFocusModal, setStopFocusModal] = useState<{ resumeOnCancel: boolean } | null>(null);
  const [focusNoteNotice, setFocusNoteNotice] = useState<string | null>(null);
  const [reflectionNotice, setReflectionNotice] = useState<{ date: string; previous: DailyReflection | null } | null>(null);

  useEffect(() => {
    if (!taskNotice) return undefined;
    const timeout = window.setTimeout(() => setTaskNotice(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [taskNotice]);

  useEffect(() => {
    if (!focusNoteNotice) return undefined;
    const timeout = window.setTimeout(() => setFocusNoteNotice(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [focusNoteNotice]);

  useEffect(() => {
    if (!reflectionNotice) return undefined;
    const timeout = window.setTimeout(() => setReflectionNotice(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [reflectionNotice]);

  function createTask(input: TaskInput) {
    const task = deskFlow.addTask(input);
    if (task) {
      setTaskNotice({ kind: "created", taskId: task.id, title: task.title, targetDate: task.date, input });
    }
  }

  function updateTask(task: Task, input: TaskInput) {
    deskFlow.updateTask(task.id, input);
    if (task.date !== input.date) {
      setTaskNotice({ kind: "moved", taskId: task.id, title: input.title, targetDate: input.date, previousDate: task.date, input });
    }
  }

  function undoTaskChange() {
    if (!taskNotice) return;
    if (taskNotice.kind === "created") {
      deskFlow.deleteTask(taskNotice.taskId);
    } else if (taskNotice.kind === "moved" && taskNotice.previousDate) {
      deskFlow.updateTask(taskNotice.taskId, { ...taskNotice.input, date: taskNotice.previousDate });
    } else {
      deskFlow.toggleTask(taskNotice.taskId);
    }
    setTaskNotice(null);
  }

  function toggleTask(task: Task) {
    deskFlow.toggleTask(task.id);
    setTaskNotice({
      kind: task.completed ? "reopened" : "completed",
      taskId: task.id,
      title: task.title,
      targetDate: task.date,
      input: {
        title: task.title,
        priority: task.priority,
        date: task.date,
        notes: task.notes,
      },
    });
  }

  function postponeTask(task: Task, date: string) {
    updateTask(task, {
      title: task.title,
      priority: task.priority,
      date,
      notes: task.notes,
    });
  }

  function requestStopTimer() {
    if (deskFlow.timerMode === "break") {
      deskFlow.stopTimer();
      return;
    }
    const resumeOnCancel = deskFlow.timerRunning;
    if (resumeOnCancel) deskFlow.toggleTimer();
    setStopFocusModal({ resumeOnCancel });
  }

  function cancelStopFocus() {
    const resumeTimer = stopFocusModal?.resumeOnCancel === true;
    setStopFocusModal(null);
    if (resumeTimer) deskFlow.toggleTimer();
  }

  function confirmStopFocus() {
    deskFlow.stopTimer();
    setStopFocusModal(null);
  }

  function saveFocusCompletionNote(note: string) {
    if (!deskFlow.focusCompletion) return;
    deskFlow.saveFocusCompletionNote(deskFlow.focusCompletion.id, note);
    setFocusNoteNotice(note.trim() ? "一句记录已写入本机专注历史。" : "本次投入已保存在本机专注历史。");
  }

  function saveDailyReflection(input: DailyReflectionInput) {
    const previous = state.dailyReflections.find((reflection) => reflection.date === input.date) ?? null;
    const reflection = deskFlow.saveDailyReflection(input);
    if (!reflection) return false;
    setReflectionNotice({ date: reflection.date, previous });
    return true;
  }

  function selectSection(section: AppSection) {
    if (section === "review") setReviewDate(getDateKey());
    setActiveSection(section);
  }

  function openReviewDate(date: string) {
    if (!isReviewDateAllowed(date)) return;
    setReviewDate(date);
    setActiveSection("review");
  }

  function undoDailyReflection() {
    if (!reflectionNotice) return;
    deskFlow.restoreDailyReflection(reflectionNotice.date, reflectionNotice.previous);
    setReflectionNotice(null);
  }

  const taskNoticeTitle = taskNotice
    ? {
        created: "任务已安排",
        moved: "任务已改期",
        completed: "任务已完成",
        reopened: "任务已恢复",
      }[taskNotice.kind]
    : "";
  const taskNoticeDetail = taskNotice
    ? taskNotice.kind === "completed"
      ? `“${taskNotice.title}”已移到“已完成”`
      : taskNotice.kind === "reopened"
        ? taskNotice.targetDate === getDateKey()
          ? `“${taskNotice.title}”已回到“今天”`
          : taskNotice.targetDate > getDateKey()
            ? `“${taskNotice.title}”已回到“即将到来”`
            : `“${taskNotice.title}”可在${formatDateLabel(taskNotice.targetDate)}的日历记录中查看`
        : `“${taskNotice.title}”已安排到${formatDateLabel(taskNotice.targetDate)}`
    : "";

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeSection === "focus" ? " focus-shell" : ""}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <WindowControls disabled={windowModalActive} />
      <Sidebar collapsed={sidebarCollapsed} activeSection={activeSection} onSelect={selectSection} onToggle={() => deskFlow.setSidebarCollapsed((collapsed) => !collapsed)} />
      <main className="main-content">
        {activeSection === "tasks" ? (
          <div className="content-grid">
            <TaskSection view={taskView} viewCounts={deskFlow.taskViewCounts} visibleTasks={visibleTasks} focusSessions={state.focusSessions} progress={deskFlow.progress} onViewChange={deskFlow.setTaskView} onCreateTask={(initialDate) => setTaskEditor({ mode: "create", initialDate })} onToggleTask={toggleTask} onDeleteTask={deskFlow.deleteTask} onEditTask={(task) => setTaskEditor({ mode: "edit", task })} onPostponeTask={postponeTask} />
            <aside className="right-column">
              <FocusCard timerMode={deskFlow.timerMode} secondsLeft={deskFlow.secondsLeft} timerRunning={deskFlow.timerRunning} sessionActive={deskFlow.timerSessionActive} timerRestored={deskFlow.timerRestored} tasks={deskFlow.focusTaskOptions} selectedTaskId={deskFlow.selectedFocusTaskId} selectionLocked={deskFlow.focusSelectionLocked} activeTaskId={deskFlow.activeFocusTaskId} activeTaskTitle={deskFlow.activeFocusTaskTitle} onTaskChange={deskFlow.selectFocusTask} onModeChange={deskFlow.setMode} onReset={deskFlow.resetTimer} onStop={requestStopTimer} onToggle={deskFlow.toggleTimer} />
              <CalendarCard tasks={state.tasks} onSelectTask={(task) => setTaskEditor({ mode: "edit", task })} onOpenReview={openReviewDate} />
            </aside>
          </div>
        ) : activeSection === "review" ? (
          <ReviewPage tasks={state.tasks} focusSessions={state.focusSessions} readingActions={state.readingActions} dailyReflections={state.dailyReflections} selectedDate={reviewDate} onSelectDate={setReviewDate} onGoToTasks={() => selectSection("tasks")} onSaveReflection={saveDailyReflection} />
        ) : (
          <FocusReader feeds={state.feeds} groups={state.groups} articles={state.articles} feedsBusy={deskFlow.feedsBusy} subscribing={deskFlow.subscribing} onSubscribe={deskFlow.subscribeFeed} onRefresh={deskFlow.refreshFeeds} onRemoveFeed={deskFlow.removeFeed} onUpdateArticle={deskFlow.updateArticle} onOpenArticle={deskFlow.recordReadingAction} onAddGroup={deskFlow.addFeedGroup} onRenameGroup={deskFlow.renameFeedGroup} onRemoveGroup={deskFlow.removeFeedGroup} onSetFeedGroup={deskFlow.setFeedGroup} />
        )}
      </main>
      {taskEditor?.mode === "create" && <TaskEditorModal mode="create" initialDate={taskEditor.initialDate} onClose={() => setTaskEditor(null)} onSave={createTask} />}
      {taskEditor?.mode === "edit" && <TaskEditorModal mode="edit" task={taskEditor.task} focusSessions={state.focusSessions} onClose={() => setTaskEditor(null)} onSave={(input) => updateTask(taskEditor.task, input)} />}
      {stopFocusModal && <StopFocusModal durationSeconds={deskFlow.elapsedTimerSeconds} taskTitle={deskFlow.activeFocusTaskTitle} resumeOnCancel={stopFocusModal.resumeOnCancel} onCancel={cancelStopFocus} onConfirm={confirmStopFocus} />}
      {deskFlow.focusCompletion && !stopFocusModal && <FocusCompletionModal session={deskFlow.focusCompletion} onSkip={deskFlow.dismissFocusCompletion} onSave={saveFocusCompletionNote} />}
      {reflectionNotice && <div className="app-status-toast" role="status" aria-live="polite">
        <span className="app-status-icon"><NotebookPen size={17} /></span>
        <span className="app-status-copy"><strong>每日回顾已保存</strong><small>{formatDateLabel(reflectionNotice.date)}的记录已写入本机。</small></span>
        <button className="app-status-action" type="button" onClick={undoDailyReflection}><RotateCcw size={13} />撤销</button>
        <button className="app-status-close" type="button" onClick={() => setReflectionNotice(null)} aria-label="关闭每日回顾通知"><X size={14} /></button>
      </div>}
      {focusNoteNotice && !reflectionNotice && <div className="app-status-toast" role="status" aria-live="polite">
        <span className="app-status-icon"><CheckCircle2 size={17} /></span>
        <span className="app-status-copy"><strong>专注记录已保存</strong><small>{focusNoteNotice}</small></span>
        <button className="app-status-close" type="button" onClick={() => setFocusNoteNotice(null)} aria-label="关闭专注记录通知"><X size={14} /></button>
      </div>}
      {taskNotice && !reflectionNotice && !focusNoteNotice && !deskFlow.focusCompletion && <div className="app-status-toast" role="status" aria-live="polite">
        <span className="app-status-icon">{taskNotice.kind === "completed" ? <CheckCircle2 size={17} /> : taskNotice.kind === "reopened" ? <RotateCcw size={17} /> : <CalendarCheck2 size={17} />}</span>
        <span className="app-status-copy"><strong>{taskNoticeTitle}</strong><small>{taskNoticeDetail}</small></span>
        <button className="app-status-action" type="button" onClick={undoTaskChange}><RotateCcw size={13} />撤销</button>
        <button className="app-status-close" type="button" onClick={() => setTaskNotice(null)} aria-label="关闭任务通知"><X size={14} /></button>
      </div>}
    </div>
  );
}
