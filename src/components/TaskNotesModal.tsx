import { FileText, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./TaskNotesModal.css";
import type { Task } from "../types";

interface TaskNotesModalProps {
  task: Task;
  onClose: () => void;
  onSave: (id: string, notes: string) => void;
}

export function TaskNotesModal({ task, onClose, onSave }: TaskNotesModalProps) {
  const [notes, setNotes] = useState(task.notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setNotes(task.notes), [task.id, task.notes]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
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

  function saveNotes() {
    onSave(task.id, notes.trim());
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="notes-modal" role="dialog" aria-modal="true" aria-labelledby="notes-title">
        <header className="notes-modal-header">
          <div><span className="section-kicker"><FileText size={15} />复盘记录</span><h2 id="notes-title">{task.title}</h2></div>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="关闭记录"><X size={17} /></button>
        </header>
        <textarea ref={textareaRef} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="记录这件事的结果、问题或下一步..." aria-label="任务复盘记录" />
        <footer className="notes-modal-footer"><span>{notes.length} 字</span><button className="save-notes-button" type="button" onClick={saveNotes}><Save size={15} />保存记录</button></footer>
      </section>
    </div>
  );
}
