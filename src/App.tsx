import { useState } from "react";
import "./App.css";
import { FocusCard } from "./components/FocusCard";
import { CalendarCard } from "./components/CalendarCard";
import { Sidebar, type AppSection } from "./components/Sidebar";
import { TaskSection } from "./components/TaskSection";
import { TaskNotesModal } from "./components/TaskNotesModal";
import { FocusReader } from "./components/FocusReader";
import type { Task } from "./types";
import { useDeskFlow } from "./hooks/useDeskFlow";

export function App() {
  const deskFlow = useDeskFlow();
  const { state, taskFilter, visibleTasks, sidebarCollapsed } = deskFlow;
  const [notesTask, setNotesTask] = useState<Task | null>(null);
  const [activeSection, setActiveSection] = useState<AppSection>("tasks");

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${activeSection === "focus" ? " focus-shell" : ""}`}>
      <div className="window-drag-region" aria-hidden="true" />
      <Sidebar collapsed={sidebarCollapsed} activeSection={activeSection} onSelect={setActiveSection} onToggle={() => deskFlow.setSidebarCollapsed((collapsed) => !collapsed)} />
      <main className="main-content">
        {activeSection === "tasks" ? (
          <div className="content-grid">
            <TaskSection filter={taskFilter} visibleTasks={visibleTasks} draft={deskFlow.draft} priority={deskFlow.priority} progress={deskFlow.progress} onFilterChange={deskFlow.setTaskFilter} onDraftChange={deskFlow.setDraft} onPriorityChange={deskFlow.setPriority} onAddTask={deskFlow.addTask} onToggleTask={deskFlow.toggleTask} onDeleteTask={deskFlow.deleteTask} onOpenNotes={setNotesTask} />
            <aside className="right-column">
              <FocusCard timerMode={deskFlow.timerMode} secondsLeft={deskFlow.secondsLeft} timerRunning={deskFlow.timerRunning} onModeChange={deskFlow.setMode} onReset={deskFlow.resetTimer} onToggle={() => deskFlow.setTimerRunning((running) => !running)} />
              <CalendarCard tasks={state.tasks} onSelectTask={setNotesTask} />
            </aside>
          </div>
        ) : (
          <FocusReader feeds={state.feeds} groups={state.groups} articles={state.articles} feedsBusy={deskFlow.feedsBusy} subscribing={deskFlow.subscribing} onSubscribe={deskFlow.subscribeFeed} onRefresh={deskFlow.refreshFeeds} onRemoveFeed={deskFlow.removeFeed} onUpdateArticle={deskFlow.updateArticle} onAddGroup={deskFlow.addFeedGroup} onRenameGroup={deskFlow.renameFeedGroup} onRemoveGroup={deskFlow.removeFeedGroup} onSetFeedGroup={deskFlow.setFeedGroup} />
        )}
      </main>
      {notesTask && <TaskNotesModal task={notesTask} onClose={() => setNotesTask(null)} onSave={deskFlow.updateTaskNotes} />}
    </div>
  );
}
