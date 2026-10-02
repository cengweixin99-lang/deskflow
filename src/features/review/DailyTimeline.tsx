import { BookOpenText, CheckCircle2, Circle, Clock3, ListTodo } from "lucide-react";
import { formatTimerDuration } from "../focus/timer";
import type { DailyTimelineItem } from "./timeline";

const TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatTimelineTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : TIME_FORMATTER.format(date);
}

function focusStatusLabel(status: "active" | "completed" | "stopped") {
  if (status === "completed") return "自然完成";
  if (status === "stopped") return "提前结束";
  return "进行中";
}

export function DailyTimeline({ items }: { items: DailyTimelineItem[] }) {
  return (
    <section className="daily-timeline-section" aria-labelledby="daily-timeline-title">
      <div className="daily-timeline-heading">
        <div>
          <span className="section-kicker"><Clock3 size={15} />行动时间轴</span>
          <h2 id="daily-timeline-title">当天计划与实际行动</h2>
        </div>
        <span>{items.length} 条记录</span>
      </div>
      {items.length === 0 ? (
        <div className="daily-timeline-empty">
          <Clock3 size={24} />
          <strong>还没有行动记录</strong>
          <span>这一天尚无任务、专注或文章打开记录。</span>
        </div>
      ) : (
        <ol className="daily-timeline-list">
          {items.map((item) => (
            <li className={`daily-timeline-item ${item.kind}`} key={item.id}>
              <time dateTime={item.occurredAt ?? undefined}>{item.occurredAt ? formatTimelineTime(item.occurredAt) : "计划"}</time>
              <span className="daily-timeline-marker" aria-hidden="true">
                {item.kind === "task" ? <ListTodo size={15} /> : item.kind === "focus" ? <Clock3 size={15} /> : <BookOpenText size={15} />}
              </span>
              {item.kind === "task" ? (
                <article className="daily-timeline-card">
                  <div className="daily-timeline-title-row">
                    <strong>{item.task.title}</strong>
                    <span className={`daily-timeline-badge ${item.task.completed ? "completed" : "pending"}`}>{item.task.completed ? <CheckCircle2 size={12} /> : <Circle size={12} />}{item.task.completed ? "已完成" : "未完成"}</span>
                  </div>
                  <small>当天计划 · {item.task.priority === "high" ? "高优先级" : item.task.priority === "medium" ? "中优先级" : "低优先级"}</small>
                  {item.task.notes && <p>{item.task.notes}</p>}
                </article>
              ) : item.kind === "focus" ? (
                <article className="daily-timeline-card">
                  <div className="daily-timeline-title-row">
                    <strong>{item.session.taskTitle || "未关联任务"}</strong>
                    <span className={`daily-timeline-badge ${item.session.status}`}>{focusStatusLabel(item.session.status)}</span>
                  </div>
                  <small>专注 {formatTimerDuration(item.session.durationSeconds)}</small>
                  {item.session.note && <p>{item.session.note}</p>}
                </article>
              ) : (
                <article className="daily-timeline-card">
                  <div className="daily-timeline-title-row">
                    <strong>{item.action.articleTitle}</strong>
                    <span className="daily-timeline-badge reading">打开文章</span>
                  </div>
                  <small>{item.action.feedTitle || "未命名来源"}</small>
                </article>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
