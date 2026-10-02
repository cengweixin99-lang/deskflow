import { CalendarCheck2, CheckCircle2, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";
import { CalendarCard } from "./features/tasks/CalendarCard";
import { Sidebar, type AppSection } from "./components/Sidebar";
import { WindowControls } from "./components/WindowControls";
import { TaskSection } from "./features/tasks/TaskSection";
import { TaskEditorModal } from "./features/tasks/TaskEditorModal";
import { ReaderPage } from "./features/reader/ReaderPage";
import { formatDateLabel } from "./types";
import type { Task, TaskInput } from "./types";
import { useDeskFlow } from "./hooks/useDeskFlow";
import { useWindowModalActive } from "./hooks/useWindowModalState";

export function App() {
  const deskFlow = useDeskFlow();
  const windowModalActive = useWindowModalActive();
  const { state, taskFilter, visibleTasks, sidebarCollapsed } = deskFlow;
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

  useEffect(() => {
    if (!taskNotice) return undefined;
    const timeout = window.setTimeout(() => setTaskNotice(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [taskNotice]);

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
      ? `“${taskNotice.title}”已标记为完成`
      : taskNotice.kind === "reopened"
        ? `“${taskNotice.title}”已恢复为待完成`
        : `“${taskNotice.title}”已安排到${formatDateLabel(taskNotice.targetDate)}`
    : "";

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeSection === "reader" ? " reader-shell" : ""}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <WindowControls disabled={windowModalActive} />
      <Sidebar collapsed={sidebarCollapsed} activeSection={activeSection} onSelect={setActiveSection} onToggle={() => deskFlow.setSidebarCollapsed((collapsed) => !collapsed)} />
      <main className="main-content">
        {activeSection === "tasks" ? (
          <div className="content-grid">
            <TaskSection filter={taskFilter} filterCounts={deskFlow.taskFilterCounts} visibleTasks={visibleTasks} progress={deskFlow.progress} onFilterChange={deskFlow.setTaskFilter} onCreateTask={(initialDate) => setTaskEditor({ mode: "create", initialDate })} onToggleTask={toggleTask} onDeleteTask={deskFlow.deleteTask} onEditTask={(task) => setTaskEditor({ mode: "edit", task })} />
            <aside className="right-column">
              <CalendarCard tasks={state.tasks} onSelectTask={(task) => setTaskEditor({ mode: "edit", task })} />
            </aside>
          </div>
        ) : (
          <ReaderPage feeds={state.feeds} groups={state.groups} articles={state.articles} feedsBusy={deskFlow.feedsBusy} subscribing={deskFlow.subscribing} onSubscribe={deskFlow.subscribeFeed} onRefresh={deskFlow.refreshFeeds} onRemoveFeed={deskFlow.removeFeed} onUpdateArticle={deskFlow.updateArticle} onOpenArticle={(id) => deskFlow.updateArticle(id, { read: true })} onAddGroup={deskFlow.addFeedGroup} onRenameGroup={deskFlow.renameFeedGroup} onRemoveGroup={deskFlow.removeFeedGroup} onSetFeedGroup={deskFlow.setFeedGroup} />
        )}
      </main>
      {taskEditor?.mode === "create" && <TaskEditorModal mode="create" initialDate={taskEditor.initialDate} onClose={() => setTaskEditor(null)} onSave={createTask} />}
      {taskEditor?.mode === "edit" && <TaskEditorModal mode="edit" task={taskEditor.task} onClose={() => setTaskEditor(null)} onSave={(input) => updateTask(taskEditor.task, input)} />}
      {taskNotice && <div className="app-status-toast" role="status" aria-live="polite">
        <span className="app-status-icon">{taskNotice.kind === "completed" ? <CheckCircle2 size={17} /> : taskNotice.kind === "reopened" ? <RotateCcw size={17} /> : <CalendarCheck2 size={17} />}</span>
        <span className="app-status-copy"><strong>{taskNoticeTitle}</strong><small>{taskNoticeDetail}</small></span>
        <button className="app-status-action" type="button" onClick={undoTaskChange}><RotateCcw size={13} />撤销</button>
        <button className="app-status-close" type="button" onClick={() => setTaskNotice(null)} aria-label="关闭任务通知"><X size={14} /></button>
      </div>}
    </div>
  );
}
