import { BatteryMedium, NotebookPen, PencilLine, Smile } from "lucide-react";
import { useEffect, useState } from "react";
import type { DailyReflection } from "../../types";
import { DailyReflectionEditor } from "./DailyReflectionEditor";
import type { DailyReflectionInput } from "./reflections";
import "./DailyReflectionSection.css";

interface DailyReflectionSectionProps {
  date: string;
  reflection: DailyReflection | null;
  onSave: (input: DailyReflectionInput) => boolean;
}

const energyLabels = ["很低", "偏低", "一般", "较好", "充足"];
const satisfactionLabels = ["很低", "偏低", "一般", "较高", "很高"];

function formatScore(score: DailyReflection["energy"], labels: string[]) {
  return score === null ? "未记录" : `${score} / 5 · ${labels[score - 1]}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "已保存在本机";
  return `${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date)}更新`;
}

export function DailyReflectionSection({ date, reflection, onSave }: DailyReflectionSectionProps) {
  const [editing, setEditing] = useState(false);

  useEffect(() => setEditing(false), [date]);

  return (
    <section className="daily-reflection-section" aria-labelledby="daily-reflection-title">
      <div className="daily-reflection-heading">
        <div>
          <span className="section-kicker"><NotebookPen size={15} />个人记录</span>
          <h2 id="daily-reflection-title">当天感受</h2>
        </div>
        <span>仅保存在本机</span>
      </div>

      {reflection ? (
        <article className="daily-reflection-card saved">
          <div className="daily-reflection-summary">
            <small>当天总结</small>
            {reflection.summary ? <p>{reflection.summary}</p> : <p className="empty">这次回顾只记录了感受评分，没有文字总结。</p>}
          </div>
          <dl className="daily-reflection-scores">
            <div><dt><BatteryMedium size={15} />精力</dt><dd>{formatScore(reflection.energy, energyLabels)}</dd></div>
            <div><dt><Smile size={15} />满意度</dt><dd>{formatScore(reflection.satisfaction, satisfactionLabels)}</dd></div>
          </dl>
          <footer className="daily-reflection-footer">
            <span>{formatUpdatedAt(reflection.updatedAt)}</span>
            <button type="button" onClick={() => setEditing(true)}><PencilLine size={14} />编辑回顾</button>
          </footer>
        </article>
      ) : (
        <div className="daily-reflection-card empty-state">
          <span className="daily-reflection-empty-icon" aria-hidden="true"><NotebookPen size={20} /></span>
          <div><strong>这一天还没有个人回顾</strong><p>可以记录总结、精力或满意度中的任意一项，不需要为了打卡而填写。</p></div>
          <button type="button" onClick={() => setEditing(true)}>填写回顾</button>
        </div>
      )}

      {editing && <DailyReflectionEditor key={date} date={date} reflection={reflection} onClose={() => setEditing(false)} onSave={onSave} />}
    </section>
  );
}
