import { Check, ChevronDown, Coffee, ListTodo, LockKeyhole, Pause, Play, RotateCcw, Square, Target } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import "./FocusCard.css";
import { formatDateLabel, getDateKey } from "../../types";
import type { Task, TimerMode } from "../../types";

interface FocusCardProps {
  timerMode: TimerMode;
  secondsLeft: number;
  timerRunning: boolean;
  sessionActive: boolean;
  tasks: Task[];
  selectedTaskId: string;
  selectionLocked: boolean;
  activeTaskId: string | null;
  activeTaskTitle: string;
  onTaskChange: (taskId: string) => void;
  onModeChange: (mode: TimerMode) => void;
  onReset: () => void;
  onStop: () => void;
  onToggle: () => void;
}

export function FocusCard({ timerMode, secondsLeft, timerRunning, sessionActive, tasks, selectedTaskId, selectionLocked, activeTaskId, activeTaskTitle, onTaskChange, onModeChange, onReset, onStop, onToggle }: FocusCardProps) {
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const taskPickerRef = useRef<HTMLDivElement>(null);
  const taskTriggerRef = useRef<HTMLButtonElement>(null);
  const taskOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const taskLabelId = useId();
  const taskValueId = useId();
  const taskListId = useId();
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const selectionValue = selectionLocked ? activeTaskId ?? "" : selectedTaskId;
  const activeTaskMissing = activeTaskId !== null && !tasks.some((task) => task.id === activeTaskId);
  const taskOptions = [
    { id: "", title: "不关联任务", meta: "只记录本次专注时间" },
    ...(activeTaskMissing ? [{ id: activeTaskId ?? "", title: activeTaskTitle, meta: "开始时关联的任务" }] : []),
    ...tasks.map((task) => ({ id: task.id, title: task.title, meta: task.date === getDateKey() ? "今天" : formatDateLabel(task.date) })),
  ];
  const selectedTaskOption = taskOptions.find((option) => option.id === selectionValue) ?? taskOptions[0];
  const buttonLabel = timerRunning
    ? timerMode === "focus" ? "暂停计时" : "暂停休息"
    : timerMode === "focus"
      ? selectionLocked ? "继续专注" : "开始专注"
      : sessionActive ? "继续休息" : "开始休息";
  const headerActionLabel = sessionActive
    ? timerMode === "focus" ? "结束本次专注" : "结束休息"
    : "重置计时器";

  function openTaskPicker() {
    if (selectionLocked) return;
    setTaskPickerOpen(true);
    requestAnimationFrame(() => {
      const selectedIndex = Math.max(0, taskOptions.findIndex((option) => option.id === selectionValue));
      taskOptionRefs.current[selectedIndex]?.focus();
    });
  }

  function closeTaskPicker(restoreFocus = true) {
    setTaskPickerOpen(false);
    if (restoreFocus) requestAnimationFrame(() => taskTriggerRef.current?.focus());
  }

  function chooseTask(taskId: string) {
    onTaskChange(taskId);
    closeTaskPicker();
  }

  function handleTaskTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openTaskPicker();
  }

  function handleTaskOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % taskOptions.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + taskOptions.length) % taskOptions.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = taskOptions.length - 1;
    else if (event.key === "Tab") {
      setTaskPickerOpen(false);
      return;
    } else return;
    event.preventDefault();
    taskOptionRefs.current[nextIndex]?.focus();
  }

  useEffect(() => {
    if (!taskPickerOpen) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!taskPickerRef.current?.contains(event.target as Node)) closeTaskPicker(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeTaskPicker();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [taskPickerOpen]);

  useEffect(() => {
    if (selectionLocked) setTaskPickerOpen(false);
  }, [selectionLocked]);

  return (
    <section className="focus-card">
      <div className="card-heading">
        <div><span className="section-kicker"><Target size={15} />专注时段</span><h2>{timerMode === "focus" ? "专注工作" : "短暂休息"}</h2></div>
        <button className="icon-button subtle" type="button" aria-label={headerActionLabel} title={headerActionLabel} onClick={sessionActive ? onStop : onReset}>{sessionActive ? <Square size={14} fill="currentColor" /> : <RotateCcw size={17} />}</button>
      </div>
      {timerMode === "focus" ? (
        <div className="focus-task-field">
          <span className="focus-task-label" id={taskLabelId}><ListTodo size={13} />关联任务{selectionLocked && <small><LockKeyhole size={11} />已锁定</small>}</span>
          <div className={`focus-task-picker${taskPickerOpen ? " open" : ""}`} ref={taskPickerRef}>
            <button
              className="focus-task-trigger"
              ref={taskTriggerRef}
              type="button"
              disabled={selectionLocked}
              aria-labelledby={`${taskLabelId} ${taskValueId}`}
              aria-haspopup="listbox"
              aria-expanded={taskPickerOpen}
              aria-controls={taskPickerOpen ? taskListId : undefined}
              onClick={() => taskPickerOpen ? closeTaskPicker(false) : openTaskPicker()}
              onKeyDown={handleTaskTriggerKeyDown}
            >
              <span className="focus-task-trigger-value" id={taskValueId}><small>{selectedTaskOption.meta}</small><strong>{selectedTaskOption.title}</strong></span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {taskPickerOpen && (
              <div className="focus-task-options" id={taskListId} role="listbox" aria-labelledby={taskLabelId}>
                {taskOptions.map((option, index) => (
                  <button
                    className={`focus-task-option${option.id === selectionValue ? " selected" : ""}`}
                    ref={(element) => { taskOptionRefs.current[index] = element; }}
                    type="button"
                    role="option"
                    aria-selected={option.id === selectionValue}
                    key={option.id || "unlinked"}
                    onClick={() => chooseTask(option.id)}
                    onKeyDown={(event) => handleTaskOptionKeyDown(event, index)}
                  >
                    <span><strong>{option.title}</strong><small>{option.meta}</small></span>
                    {option.id === selectionValue && <Check size={14} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <small className="focus-task-help">
            {selectionLocked
              ? activeTaskTitle ? `本次专注已关联“${activeTaskTitle}”，暂停后可以继续。` : "本次专注未关联任务，暂停后可以继续。"
              : tasks.length ? "选择后，本次专注时间会记到对应任务。" : "暂无未完成任务，也可以直接开始无关联专注。"}
          </small>
        </div>
      ) : (
        <div className="focus-task-rest"><Coffee size={14} /><span>{sessionActive ? "休息计时中，右上角可以提前结束" : "休息时段不关联任务"}</span></div>
      )}
      <div className="timer-display"><span>{minutes}</span><b>:</b><span>{seconds}</span></div>
      <div className="timer-mode">
        <button className={timerMode === "focus" ? "selected" : ""} type="button" disabled={sessionActive} title={sessionActive ? "结束当前计时后可切换模式" : undefined} onClick={() => onModeChange("focus")}>专注 25</button>
        <button className={timerMode === "break" ? "selected" : ""} type="button" disabled={sessionActive} title={sessionActive ? "结束当前计时后可切换模式" : undefined} onClick={() => onModeChange("break")}>休息 5</button>
      </div>
      <button className="timer-button" type="button" onClick={onToggle}>
        {timerRunning ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
        <span>{buttonLabel}</span>
      </button>
    </section>
  );
}
