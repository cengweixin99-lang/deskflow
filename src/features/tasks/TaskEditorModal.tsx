import { CalendarClock, CalendarDays, ClipboardPenLine, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./TaskEditorModal.css";
import { formatDateLabel, getDateKey } from "../../types";
import type { FocusSession, Task, TaskInput, TaskPriority } from "../../types";
import { useWindowModalState } from "../../hooks/useWindowModalState";
import { DatePicker } from "./DatePicker";
import { TaskFocusHistory } from "./TaskFocusHistory";
import { getTaskEarliestDate } from "./taskDates";

interface TaskEditorModalProps {
  mode: "create" | "edit";
  task?: Task;
  focusSessions?: FocusSession[];
  initialDate?: string;
  onClose: () => void;
  onSave: (input: TaskInput) => void;
}

export function TaskEditorModal({ mode, task, focusSessions = [], initialDate = getDateKey(), onClose, onSave }: TaskEditorModalProps) {
  useWindowModalState();
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [date, setDate] = useState(task?.date ?? initialDate);
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, []);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setPriority(task?.priority ?? "medium");
    setDate(task?.date ?? initialDate);
    setNotes(task?.notes ?? "");
    setError("");
  }, [initialDate, mode, task]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, task?.id]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("任务标题不能为空");
      titleRef.current?.focus();
      return;
    }
    if (!date) {
      setError("请选择任务日期");
      return;
    }
    onSave({
      title: trimmedTitle,
      priority,
      date,
      notes: notes.trim(),
    });
    onClose();
  }

  const dateChanged = mode === "edit" && task && date !== task.date;
  const dateChangeMessage = dateChanged
    ? date === getDateKey()
      ? "保存后，这项任务会回到“今天”列表。"
      : task.date === getDateKey()
        ? `保存后，这项任务会移出“今天”列表，安排到${formatDateLabel(date)}。`
        : `保存后，这项任务会改期到${formatDateLabel(date)}。`
    : "";
  const earliestDate = mode === "edit" && task ? getTaskEarliestDate(task) : getDateKey();

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-editor-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header className="task-editor-header">
          <div><span className="section-kicker"><ClipboardPenLine size={15} />任务详情</span><h2 id="task-editor-title">{mode === "create" ? "添加任务" : "编辑任务"}</h2></div>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="关闭任务编辑"><X size={17} /></button>
        </header>
        <form onSubmit={saveTask}>
          <label className="task-editor-field">
            <span>标题</span>
            <input ref={titleRef} value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} maxLength={120} aria-describedby={error ? "task-editor-error" : undefined} />
          </label>
          <div className="task-editor-row">
            <fieldset className="task-editor-field task-editor-priority">
              <legend>优先级</legend>
              <div>
                {(["high", "medium", "low"] as const).map((item) => (
                  <button key={item} type="button" className={`priority-choice ${item}${priority === item ? " selected" : ""}`} onClick={() => setPriority(item)} aria-pressed={priority === item}>
                    <i />{item === "high" ? "高" : item === "medium" ? "中" : "低"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="task-editor-field task-editor-date">
              <span id="task-editor-date-label"><CalendarDays size={13} />日期</span>
              <DatePicker value={date} min={earliestDate} labelId="task-editor-date-label" describedBy={error ? "task-editor-error" : "task-editor-date-limit"} invalid={error === "请选择任务日期"} onChange={(nextDate) => { setDate(nextDate); setError(""); }} />
              {mode === "edit" && <small className="task-editor-date-limit" id="task-editor-date-limit">最早可安排到创建日：{formatDateLabel(earliestDate)}</small>}
            </div>
          </div>
          {dateChangeMessage && <div className="task-date-change-notice"><CalendarClock size={15} /><span>{dateChangeMessage}</span></div>}
          <label className="task-editor-field">
            <span>记录</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录这件事的背景、结果或下一步..." />
          </label>
          {mode === "edit" && task && <TaskFocusHistory focusSessions={focusSessions} taskId={task.id} />}
          {error && <p className="task-editor-error" id="task-editor-error" role="alert">{error}</p>}
          <footer className="task-editor-footer">
            <span>{notes.length} 字记录</span>
            <div><button className="cancel-button" type="button" onClick={onClose}>取消</button><button className="save-task-button" type="submit">{mode === "create" && <Plus size={15} />}{mode === "create" ? "添加任务" : "保存任务"}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
