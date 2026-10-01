import { AlertTriangle, X } from "lucide-react";
import { useEffect } from "react";
import "./DeleteConfirmModal.css";
import "../../styles/confirm-modal.css";
import type { Task } from "../../types";
import { useWindowModalState } from "../../hooks/useWindowModalState";

interface DeleteConfirmModalProps {
  task: Task;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ task, onCancel, onConfirm }: DeleteConfirmModalProps) {
  useWindowModalState();
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-description"
      >
        <header className="confirm-modal-header">
          <span className="confirm-modal-icon danger" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <button className="icon-button subtle" type="button" onClick={onCancel} aria-label="关闭确认弹窗">
            <X size={17} />
          </button>
        </header>
        <h2 id="delete-confirm-title">删除任务</h2>
        <p id="delete-confirm-description" className="confirm-modal-message">
          确定要删除“{task.title}”吗？
          <br />
          删除后无法恢复。
        </p>
        <footer className="confirm-modal-footer">
          <button className="cancel-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="confirm-modal-primary danger" type="button" onClick={onConfirm}>
            删除
          </button>
        </footer>
      </section>
    </div>
  );
}
