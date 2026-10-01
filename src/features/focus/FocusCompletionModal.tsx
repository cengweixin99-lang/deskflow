import { CircleCheckBig, NotebookPen, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useWindowModalState } from "../../hooks/useWindowModalState";
import type { FocusSession } from "../../types";
import "../../styles/confirm-modal.css";
import "./FocusCompletionModal.css";
import { FOCUS_SESSION_NOTE_MAX_LENGTH } from "./sessions";
import { formatTimerDuration } from "./timer";

interface FocusCompletionModalProps {
  session: FocusSession;
  onSkip: () => void;
  onSave: (note: string) => void;
}

export function FocusCompletionModal({ session, onSkip, onSave }: FocusCompletionModalProps) {
  useWindowModalState();
  const [note, setNote] = useState(session.note);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null;
    const frame = requestAnimationFrame(() => noteRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) {
          returnTarget.focus();
        } else {
          document.querySelector<HTMLButtonElement>(".timer-button")?.focus();
        }
      });
    };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onSkip();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onSkip]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(note);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onSkip(); }}>
      <section className="confirm-modal focus-completion-modal" role="dialog" aria-modal="true" aria-labelledby="focus-completion-title" aria-describedby="focus-completion-summary">
        <header className="confirm-modal-header">
          <span className="confirm-modal-icon focus-completion-icon" aria-hidden="true"><CircleCheckBig size={18} /></span>
          <button className="icon-button subtle" type="button" onClick={onSkip} aria-label="关闭专注完成弹窗"><X size={17} /></button>
        </header>
        <h2 id="focus-completion-title">本次专注已记录</h2>
        <p className="confirm-modal-message" id="focus-completion-summary">
          实际投入 <strong>{formatTimerDuration(session.durationSeconds)}</strong>{session.taskTitle ? `，关联“${session.taskTitle}”` : "，未关联任务"}。
          <br />
          这条专注记录已经保存在本机。
        </p>
        <form onSubmit={submit}>
          <label className="focus-completion-field">
            <span><NotebookPen size={13} />补充一句记录（可选）</span>
            <textarea ref={noteRef} value={note} maxLength={FOCUS_SESSION_NOTE_MAX_LENGTH} placeholder="记录完成了什么、遇到的中断或下一步..." onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="focus-completion-meta"><span>保存到本机专注历史</span><span>{note.length}/{FOCUS_SESSION_NOTE_MAX_LENGTH}</span></div>
          <footer className="confirm-modal-footer">
            <button className="cancel-button" type="button" onClick={onSkip}>暂不补充</button>
            <button className="confirm-modal-primary" type="submit">保存记录</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
