import { CheckCircle2, CircleStop, Clock3 } from "lucide-react";
import { formatTimerDuration } from "../focus/timer";
import type { getDailyStats } from "./stats";

type DailyStatsValue = ReturnType<typeof getDailyStats>;

function formatDailyFocusDuration(durationSeconds: number) {
  return durationSeconds === 0 ? "0 分钟" : formatTimerDuration(durationSeconds);
}

export function DailyStats({ stats }: { stats: DailyStatsValue }) {
  const completionLabel = stats.completionRate === null ? "暂无计划" : `${stats.completionRate}%`;

  return (
    <section className="daily-stats-section" aria-labelledby="daily-stats-title">
      <div className="daily-stats-heading">
        <div>
          <span className="section-kicker"><CheckCircle2 size={15} />当天事实</span>
          <h2 id="daily-stats-title">计划与投入</h2>
        </div>
        <span>由原始记录实时计算</span>
      </div>
      <div className="daily-stats-grid">
        <article className="daily-stat-card completion" aria-label={stats.completionRate === null ? "这一天没有计划任务" : `计划完成率 ${stats.completionRate}%，完成 ${stats.completedTaskCount} 项，共 ${stats.taskCount} 项`}>
          <span className="daily-stat-icon"><CheckCircle2 size={18} /></span>
          <span className="daily-stat-copy">
            <small>计划完成</small>
            <strong>{completionLabel}</strong>
            <span>{stats.taskCount === 0 ? "这一天没有计划任务" : `${stats.completedTaskCount} / ${stats.taskCount} 项完成`}</span>
          </span>
          {stats.completionRate !== null && <span className="daily-stat-progress" aria-hidden="true"><i style={{ width: `${stats.completionRate}%` }} /></span>}
        </article>
        <article className="daily-stat-card focus" aria-label={`实际专注 ${formatDailyFocusDuration(stats.focusDurationSeconds)}，共 ${stats.focusSessionCount} 段已结束记录`}>
          <span className="daily-stat-icon"><Clock3 size={18} /></span>
          <span className="daily-stat-copy">
            <small>实际专注</small>
            <strong>{formatDailyFocusDuration(stats.focusDurationSeconds)}</strong>
            <span>{stats.focusSessionCount} 段已结束记录</span>
          </span>
        </article>
        <article className="daily-stat-card stopped" aria-label={`提前结束 ${stats.stoppedFocusCount} 次，不推断中断原因`}>
          <span className="daily-stat-icon"><CircleStop size={18} /></span>
          <span className="daily-stat-copy">
            <small>提前结束</small>
            <strong>{stats.stoppedFocusCount} 次</strong>
            <span>{stats.stoppedFocusCount > 0 ? "仍计入实际投入" : "没有提前结束记录"}</span>
          </span>
          <span className="daily-stat-caveat">只记录事实，不推断原因</span>
        </article>
      </div>
      <p className="daily-stats-note">完成率基于当前仍安排在这一天的任务；提前结束不等于低效，也不能单独说明中断原因。</p>
    </section>
  );
}
