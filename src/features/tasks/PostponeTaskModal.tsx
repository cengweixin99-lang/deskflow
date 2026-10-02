import { CalendarClock, CalendarDays, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./TaskEditorModal.css";
import "./DeleteConfirmModal.css";
import "./PostponeTaskModal.css";
import { formatDateLabel, getDateKey } from "../../types";
import type { Task } from "../../types";
import { useWindowModalState } from "../../hooks/useWindowModalState";
import { DatePicker } from "./DatePicker";

interface PostponeTaskModalProps {
  task: Task;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

export function PostponeTaskModal({ task, onCancel, onConfirm }: PostponeTaskModalProps) {
  useWindowModalState();
  const today = getDateKey();
  const currentOrToday = task.date > today ? task.date : today;
  const earliestDate = addDays(currentOrToday, 1);
  const [date, setDate] = useState(earliestDate);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dateRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) {
          returnTarget.focus();
        } else {
          document.querySelector<HTMLElement>(".task-filter-trigger")?.focus();
        }
      });
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  function postponeTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const selectedDate = date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate) || selectedDate < earliestDate) {
      setError(`请选择${formatDateLabel(earliestDate)}或更晚的日期`);
      dateRef.current?.focus();
      return;
    }
    setSubmitting(true);
    onConfirm(selectedDate);
    onCancel();
  }

  const movesFromToday = task.date <= today;
  const isTomorrow = movesFromToday && date === earliestDate;
  const destinationMessage = !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ? "请选择新的安排日期，任务会保留在当前日期。"
    : movesFromToday
      ? `保存后，这项任务会离开“今天”，安排到${formatDateLabel(date)}。`
      : `保存后，这项任务会从${formatDateLabel(task.date)}改期到${formatDateLabel(date)}。`;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="task-editor-modal postpone-task-modal" role="dialog" aria-modal="true" aria-labelledby="postpone-task-title" aria-describedby="postpone-task-description">
        <header className="task-editor-header">
          <div><span className="section-kicker"><CalendarClock size={15} />任务安排</span><h2 id="postpone-task-title">推迟任务</h2></div>
          <button className="icon-button subtle" type="button" onClick={onCancel} aria-label="关闭推迟任务弹窗"><X size={17} /></button>
        </header>
        <form onSubmit={postponeTask} noValidate>
          <p className="postpone-task-name">“{task.title}”</p>
          <div className="task-editor-field task-editor-date">
            <span id="postpone-task-date-label"><CalendarDays size={13} />新日期</span>
            <DatePicker buttonRef={dateRef} value={date} min={earliestDate} labelId="postpone-task-date-label" describedBy={error ? "postpone-task-description postpone-task-error" : "postpone-task-description"} invalid={Boolean(error)} onChange={(nextDate) => { setDate(nextDate); setError(""); }} />
          </div>
          <div className="task-date-change-notice" id="postpone-task-description"><CalendarClock size={15} /><span>{destinationMessage}</span></div>
          {error && <p className="task-editor-error" id="postpone-task-error" role="alert">{error}</p>}
          <footer className="task-editor-footer postpone-task-footer">
            <span>当前安排：{formatDateLabel(task.date)}</span>
            <div><button className="cancel-button" type="button" onClick={onCancel}>取消</button><button className="save-task-button" type="submit" disabled={submitting}>{isTomorrow ? "推迟到明天" : "安排到这一天"}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
