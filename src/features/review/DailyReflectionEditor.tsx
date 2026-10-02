import { BatteryMedium, NotebookPen, Smile, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useWindowModalState } from "../../hooks/useWindowModalState";
import { formatDateLabel } from "../../types";
import type { DailyReflection, ReflectionScore } from "../../types";
import "../../styles/confirm-modal.css";
import { DAILY_REFLECTION_SUMMARY_MAX_LENGTH } from "./reflections";
import type { DailyReflectionInput } from "./reflections";
import "./DailyReflectionEditor.css";

interface DailyReflectionEditorProps {
  date: string;
  reflection: DailyReflection | null;
  onClose: () => void;
  onSave: (input: DailyReflectionInput) => boolean;
}

const scoreOptions: Array<ReflectionScore | null> = [null, 1, 2, 3, 4, 5];

function scoreOptionLabel(score: ReflectionScore | null, kind: "energy" | "satisfaction") {
  if (score === null) return "暂不记录";
  const labels = kind === "energy"
    ? ["很低", "偏低", "一般", "较好", "充足"]
    : ["很低", "偏低", "一般", "较高", "很高"];
  return `${score}，${labels[score - 1]}`;
}

export function DailyReflectionEditor({ date, reflection, onClose, onSave }: DailyReflectionEditorProps) {
  useWindowModalState();
  const [summary, setSummary] = useState(reflection?.summary ?? "");
  const [energy, setEnergy] = useState<ReflectionScore | null>(reflection?.energy ?? null);
  const [satisfaction, setSatisfaction] = useState<ReflectionScore | null>(reflection?.satisfaction ?? null);
  const [error, setError] = useState("");
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => summaryRef.current?.focus());
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
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary.trim() && energy === null && satisfaction === null) {
      setError("至少记录一项总结、精力或满意度。");
      summaryRef.current?.focus();
      return;
    }
    if (!onSave({ date, summary, energy, satisfaction })) {
      setError("这条回顾暂时无法保存，请检查内容后重试。");
      return;
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="confirm-modal daily-reflection-editor" role="dialog" aria-modal="true" aria-labelledby="daily-reflection-editor-title" aria-describedby="daily-reflection-editor-intro">
        <header className="confirm-modal-header">
          <span className="confirm-modal-icon daily-reflection-editor-icon" aria-hidden="true"><NotebookPen size={18} /></span>
          <button className="icon-button subtle" type="button" onClick={onClose} aria-label="关闭每日回顾编辑器"><X size={17} /></button>
        </header>
        <h2 id="daily-reflection-editor-title">{reflection ? "编辑" : "填写"}{formatDateLabel(date)}的回顾</h2>
        <p className="confirm-modal-message" id="daily-reflection-editor-intro">记录会保存在本机。可以只填写其中一项，也可以稍后继续修改。</p>
        <form onSubmit={submit}>
          <label className="daily-reflection-summary-field">
            <span><NotebookPen size={13} />当天总结</span>
            <textarea ref={summaryRef} value={summary} maxLength={DAILY_REFLECTION_SUMMARY_MAX_LENGTH} placeholder="记录今天发生了什么、有什么感受，或明天想调整什么..." aria-describedby="daily-reflection-summary-meta" onChange={(event) => { setSummary(event.target.value); setError(""); }} />
          </label>
          <div className="daily-reflection-summary-meta" id="daily-reflection-summary-meta"><span>用户原始记录，不会被自动改写</span><span>{summary.length}/{DAILY_REFLECTION_SUMMARY_MAX_LENGTH}</span></div>

          <fieldset className="daily-reflection-score-field">
            <legend><BatteryMedium size={13} />精力</legend>
            <div className="daily-reflection-score-options">
              {scoreOptions.map((score) => (
                <label key={score ?? "empty"} className={energy === score ? "selected" : ""}>
                  <input type="radio" name={`reflection-energy-${date}`} checked={energy === score} aria-label={scoreOptionLabel(score, "energy")} onChange={() => { setEnergy(score); setError(""); }} />
                  <span>{score ?? "—"}</span>
                </label>
              ))}
            </div>
            <small>1 很低 · 3 一般 · 5 充足 · — 不记录</small>
          </fieldset>

          <fieldset className="daily-reflection-score-field">
            <legend><Smile size={13} />满意度</legend>
            <div className="daily-reflection-score-options">
              {scoreOptions.map((score) => (
                <label key={score ?? "empty"} className={satisfaction === score ? "selected" : ""}>
                  <input type="radio" name={`reflection-satisfaction-${date}`} checked={satisfaction === score} aria-label={scoreOptionLabel(score, "satisfaction")} onChange={() => { setSatisfaction(score); setError(""); }} />
                  <span>{score ?? "—"}</span>
                </label>
              ))}
            </div>
            <small>1 很低 · 3 一般 · 5 很高 · — 不记录</small>
          </fieldset>

          {error && <p className="daily-reflection-editor-error" role="alert">{error}</p>}
          <footer className="confirm-modal-footer">
            <button className="cancel-button" type="button" onClick={onClose}>取消</button>
            <button className="confirm-modal-primary" type="submit">保存回顾</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
