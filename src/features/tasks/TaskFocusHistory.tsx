import { Clock3, History } from "lucide-react";
import type { FocusSession } from "../../types";
import { formatTimerDuration } from "../focus/timer";
import { getTaskFocusSummary } from "./focusHistory";
import "./TaskFocusHistory.css";

interface TaskFocusHistoryProps {
  focusSessions: FocusSession[];
  taskId: string;
}

const sessionDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatSessionDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "时间未知" : sessionDateFormatter.format(date);
}

function getSessionStatusLabel(session: FocusSession) {
  if (session.status === "completed") return "自然完成";
  if (session.status === "stopped") return "提前结束";
  return "进行中";
}

export function TaskFocusHistory({ focusSessions, taskId }: TaskFocusHistoryProps) {
  const summary = getTaskFocusSummary(focusSessions, taskId);

  return (
    <section className="task-focus-history" aria-labelledby="task-focus-history-title">
      <header className="task-focus-history-header">
        <div>
          <span className="section-kicker"><History size={14} />实际投入</span>
          <h3 id="task-focus-history-title">专注历史</h3>
        </div>
        {summary.sessions.length > 0 && (
          <div className="task-focus-history-total" aria-label={`累计专注 ${formatTimerDuration(summary.totalDurationSeconds)}，共 ${summary.sessions.length} 次记录`}>
            <strong>{formatTimerDuration(summary.totalDurationSeconds)}</strong>
            <small>{summary.sessions.length} 次记录</small>
          </div>
        )}
      </header>
      {summary.sessions.length === 0 ? (
        <div className="task-focus-history-empty">
          <Clock3 size={20} />
          <div><strong>还没有专注记录</strong><span>开始专注时关联此任务，实际投入会显示在这里。</span></div>
        </div>
      ) : (
        <ol className="task-focus-history-list">
          {summary.sessions.map((session) => (
            <li key={session.id}>
              <div className="task-focus-session-heading">
                <div>
                  <time dateTime={session.startedAt}>{formatSessionDate(session.startedAt)}</time>
                  <span className={`task-focus-session-status ${session.status}`}>{getSessionStatusLabel(session)}</span>
                </div>
                <strong>{formatTimerDuration(session.durationSeconds)}</strong>
              </div>
              {session.note && <p>{session.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
