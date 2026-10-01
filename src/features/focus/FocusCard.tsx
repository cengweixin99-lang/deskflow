import { ChevronDown, Coffee, ListTodo, LockKeyhole, Pause, Play, RotateCcw, Target } from "lucide-react";
import "./FocusCard.css";
import { formatDateLabel, getDateKey } from "../../types";
import type { Task, TimerMode } from "../../types";

interface FocusCardProps {
  timerMode: TimerMode;
  secondsLeft: number;
  timerRunning: boolean;
  tasks: Task[];
  selectedTaskId: string;
  selectionLocked: boolean;
  activeTaskId: string | null;
  activeTaskTitle: string;
  onTaskChange: (taskId: string) => void;
  onModeChange: (mode: TimerMode) => void;
  onReset: () => void;
  onToggle: () => void;
}

export function FocusCard({ timerMode, secondsLeft, timerRunning, tasks, selectedTaskId, selectionLocked, activeTaskId, activeTaskTitle, onTaskChange, onModeChange, onReset, onToggle }: FocusCardProps) {
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const selectionValue = selectionLocked ? activeTaskId ?? "" : selectedTaskId;
  const activeTaskMissing = activeTaskId !== null && !tasks.some((task) => task.id === activeTaskId);
  const buttonLabel = timerRunning
    ? timerMode === "focus" ? "暂停计时" : "暂停休息"
    : timerMode === "focus"
      ? selectionLocked ? "继续专注" : "开始专注"
      : "开始休息";

  return (
    <section className="focus-card">
      <div className="card-heading">
        <div><span className="section-kicker"><Target size={15} />专注时段</span><h2>{timerMode === "focus" ? "专注工作" : "短暂休息"}</h2></div>
        <button className="icon-button subtle" type="button" aria-label="重置计时器" title="重置计时器" onClick={onReset}><RotateCcw size={17} /></button>
      </div>
      {timerMode === "focus" ? (
        <label className="focus-task-field">
          <span className="focus-task-label"><ListTodo size={13} />关联任务{selectionLocked && <small><LockKeyhole size={11} />已锁定</small>}</span>
          <span className="focus-task-select-wrap">
            <select value={selectionValue} disabled={selectionLocked} onChange={(event) => onTaskChange(event.target.value)}>
              <option value="">不关联任务</option>
              {activeTaskMissing && <option value={activeTaskId ?? ""}>{activeTaskTitle}</option>}
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.date === getDateKey() ? "今天" : formatDateLabel(task.date)} · {task.title}</option>)}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </span>
          <small className="focus-task-help">
            {selectionLocked
              ? activeTaskTitle ? `本次专注已关联“${activeTaskTitle}”，重置后可重新选择。` : "本次专注未关联任务，重置后可重新选择。"
              : tasks.length ? "选择后，本次专注时间会记到对应任务。" : "暂无未完成任务，也可以直接开始无关联专注。"}
          </small>
        </label>
      ) : (
        <div className="focus-task-rest"><Coffee size={14} /><span>休息时段不关联任务</span></div>
      )}
      <div className="timer-display"><span>{minutes}</span><b>:</b><span>{seconds}</span></div>
      <div className="timer-mode">
        <button className={timerMode === "focus" ? "selected" : ""} type="button" onClick={() => onModeChange("focus")}>专注 25</button>
        <button className={timerMode === "break" ? "selected" : ""} type="button" onClick={() => onModeChange("break")}>休息 5</button>
      </div>
      <button className="timer-button" type="button" onClick={onToggle}>
        {timerRunning ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
        <span>{buttonLabel}</span>
      </button>
    </section>
  );
}
