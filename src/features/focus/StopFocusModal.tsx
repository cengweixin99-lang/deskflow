import { Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useWindowModalState } from "../../hooks/useWindowModalState";
import { formatTimerDuration } from "./timer";
import "../../styles/confirm-modal.css";

interface StopFocusModalProps {
  durationSeconds: number;
  taskTitle: string;
  resumeOnCancel: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function StopFocusModal({ durationSeconds, taskTitle, resumeOnCancel, onCancel, onConfirm }: StopFocusModalProps) {
  useWindowModalState();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="stop-focus-title" aria-describedby="stop-focus-description">
        <header className="confirm-modal-header">
          <span className="confirm-modal-icon" aria-hidden="true"><Square size={16} fill="currentColor" /></span>
          <button className="icon-button subtle" type="button" onClick={onCancel} aria-label="关闭结束专注弹窗"><X size={17} /></button>
        </header>
        <h2 id="stop-focus-title">结束本次专注？</h2>
        <p className="confirm-modal-message" id="stop-focus-description">
          当前已专注 <strong>{formatTimerDuration(durationSeconds)}</strong>{taskTitle ? `，关联“${taskTitle}”` : "，未关联任务"}。
          <br />
          结束后会保存为提前结束记录，不能继续本次计时。
        </p>
        <footer className="confirm-modal-footer">
          <button className="cancel-button" ref={cancelRef} type="button" onClick={onCancel}>{resumeOnCancel ? "继续专注" : "暂不结束"}</button>
          <button className="confirm-modal-primary" type="button" onClick={onConfirm}>结束并保存</button>
        </footer>
      </section>
    </div>
  );
}
