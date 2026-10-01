import { CalendarDays, ClipboardPenLine, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import "./TaskEditorModal.css";
import type { Task, TaskInput, TaskPriority } from "../types";

interface TaskEditorModalProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, input: TaskInput) => void;
}

export function TaskEditorModal({ task, onClose, onSave }: TaskEditorModalProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [date, setDate] = useState(task.date);
  const [notes, setNotes] = useState(task.notes);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setPriority(task.priority);
    setDate(task.date);
    setNotes(task.notes);
    setError("");
  }, [task]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [task.id]);

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
    onSave(task.id, {
      title: trimmedTitle,
      priority,
      date,
      notes: notes.trim(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-editor-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header className="task-editor-header">
          <div><span className="section-kicker"><ClipboardPenLine size={15} />任务详情</span><h2 id="task-editor-title">编辑任务</h2></div>
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
            <label className="task-editor-field task-editor-date">
              <span><CalendarDays size={13} />日期</span>
              <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setError(""); }} required />
            </label>
          </div>
          <label className="task-editor-field">
            <span>记录</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录这件事的背景、结果或下一步..." />
          </label>
          {error && <p className="task-editor-error" id="task-editor-error" role="alert">{error}</p>}
          <footer className="task-editor-footer">
            <span>{notes.length} 字记录</span>
            <div><button className="cancel-button" type="button" onClick={onClose}>取消</button><button className="save-task-button" type="submit"><Save size={15} />保存任务</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}
