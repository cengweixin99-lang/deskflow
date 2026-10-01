import { CalendarCheck2, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";
import { FocusCard } from "./components/FocusCard";
import { CalendarCard } from "./components/CalendarCard";
import { Sidebar, type AppSection } from "./components/Sidebar";
import { TaskSection } from "./components/TaskSection";
import { TaskEditorModal } from "./components/TaskEditorModal";
import { FocusReader } from "./components/FocusReader";
import { formatDateLabel, getDateKey } from "./types";
import type { Task, TaskInput } from "./types";
import { useDeskFlow } from "./hooks/useDeskFlow";

export function App() {
  const deskFlow = useDeskFlow();
  const { state, taskFilter, visibleTasks, sidebarCollapsed } = deskFlow;
  const [taskEditor, setTaskEditor] = useState<{ mode: "create" } | { mode: "edit"; task: Task } | null>(null);
  const [taskNotice, setTaskNotice] = useState<{
    kind: "created" | "moved";
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
    if (task && task.date !== getDateKey()) {
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
    } else if (taskNotice.previousDate) {
      deskFlow.updateTask(taskNotice.taskId, { ...taskNotice.input, date: taskNotice.previousDate });
    }
    setTaskNotice(null);
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeSection === "focus" ? " focus-shell" : ""}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <Sidebar collapsed={sidebarCollapsed} activeSection={activeSection} onSelect={setActiveSection} onToggle={() => deskFlow.setSidebarCollapsed((collapsed) => !collapsed)} />
      <main className="main-content">
        {activeSection === "tasks" ? (
          <div className="content-grid">
            <TaskSection filter={taskFilter} visibleTasks={visibleTasks} progress={deskFlow.progress} onFilterChange={deskFlow.setTaskFilter} onCreateTask={() => setTaskEditor({ mode: "create" })} onToggleTask={deskFlow.toggleTask} onDeleteTask={deskFlow.deleteTask} onEditTask={(task) => setTaskEditor({ mode: "edit", task })} />
            <aside className="right-column">
              <FocusCard timerMode={deskFlow.timerMode} secondsLeft={deskFlow.secondsLeft} timerRunning={deskFlow.timerRunning} onModeChange={deskFlow.setMode} onReset={deskFlow.resetTimer} onToggle={() => deskFlow.setTimerRunning((running) => !running)} />
              <CalendarCard tasks={state.tasks} onSelectTask={(task) => setTaskEditor({ mode: "edit", task })} />
            </aside>
          </div>
        ) : (
          <FocusReader feeds={state.feeds} groups={state.groups} articles={state.articles} feedsBusy={deskFlow.feedsBusy} subscribing={deskFlow.subscribing} onSubscribe={deskFlow.subscribeFeed} onRefresh={deskFlow.refreshFeeds} onRemoveFeed={deskFlow.removeFeed} onUpdateArticle={deskFlow.updateArticle} onAddGroup={deskFlow.addFeedGroup} onRenameGroup={deskFlow.renameFeedGroup} onRemoveGroup={deskFlow.removeFeedGroup} onSetFeedGroup={deskFlow.setFeedGroup} />
        )}
      </main>
      {taskEditor?.mode === "create" && <TaskEditorModal mode="create" onClose={() => setTaskEditor(null)} onSave={createTask} />}
      {taskEditor?.mode === "edit" && <TaskEditorModal mode="edit" task={taskEditor.task} onClose={() => setTaskEditor(null)} onSave={(input) => updateTask(taskEditor.task, input)} />}
      {taskNotice && <div className="task-change-toast" role="status" aria-live="polite">
        <span className="task-change-icon"><CalendarCheck2 size={17} /></span>
        <span className="task-change-copy"><strong>{taskNotice.kind === "created" ? "任务已安排" : "任务已改期"}</strong><small>“{taskNotice.title}”已安排到{formatDateLabel(taskNotice.targetDate)}</small></span>
        <button className="task-change-undo" type="button" onClick={undoTaskChange}><RotateCcw size={13} />撤销</button>
        <button className="task-change-close" type="button" onClick={() => setTaskNotice(null)} aria-label="关闭任务通知"><X size={14} /></button>
      </div>}
    </div>
  );
}
