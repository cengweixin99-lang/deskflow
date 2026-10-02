import { BookOpenText, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock3, NotebookText, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { DailyReflection, FocusSession, ReadingAction, Task } from "../../types";
import { getDateKey } from "../../types";
import { DailyReflectionSection } from "./DailyReflectionSection";
import { DailyStats } from "./DailyStats";
import { DailyTimeline } from "./DailyTimeline";
import { FocusTrendSection } from "./FocusTrendSection";
import { getDailyRecordOverview, isReviewDateAllowed, shiftReviewDate } from "./dailyRecords";
import type { DailyReflectionInput } from "./reflections";
import { getDailyStats } from "./stats";
import { getDailyTimelineItems } from "./timeline";
import "./ReviewPage.css";

interface ReviewPageProps {
  tasks: Task[];
  focusSessions: FocusSession[];
  readingActions: ReadingAction[];
  dailyReflections: DailyReflection[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onGoToTasks: () => void;
  onSaveReflection: (input: DailyReflectionInput) => boolean;
}

function formatReviewDate(dateKey: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export function ReviewPage({ tasks, focusSessions, readingActions, dailyReflections, selectedDate, onSelectDate, onGoToTasks, onSaveReflection }: ReviewPageProps) {
  const today = getDateKey();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isToday = selectedDate === today;
  const overview = useMemo(() => getDailyRecordOverview({
    date: selectedDate,
    tasks,
    focusSessions,
    readingActions,
    dailyReflections,
  }), [dailyReflections, focusSessions, readingActions, selectedDate, tasks]);
  const timelineItems = useMemo(() => getDailyTimelineItems({
    date: selectedDate,
    tasks,
    focusSessions,
    readingActions,
  }), [focusSessions, readingActions, selectedDate, tasks]);
  const dailyStats = useMemo(() => getDailyStats({
    date: selectedDate,
    tasks,
    focusSessions,
  }), [focusSessions, selectedDate, tasks]);
  const selectedReflection = useMemo(
    () => dailyReflections.find((reflection) => reflection.date === selectedDate) ?? null,
    [dailyReflections, selectedDate],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => headingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  function selectDate(date: string) {
    if (!isReviewDateAllowed(date, today)) return false;
    onSelectDate(date);
    return true;
  }

  return (
    <section className="review-page">
      <header className="review-heading">
        <div>
          <p className="review-eyebrow">{isToday ? "今天 · 本地记录" : "历史回顾 · 本地记录"}</p>
          <h1 ref={headingRef} tabIndex={-1}>{isToday ? "今天的回顾" : formatReviewDate(selectedDate)}</h1>
        </div>
        {!isToday && (
          <button className="review-today-button" type="button" onClick={() => selectDate(today)}>
            <RotateCcw size={14} />回到今天
          </button>
        )}
      </header>

      <div className="review-date-toolbar" aria-label="选择回顾日期">
        <button className="review-date-button" type="button" onClick={() => selectDate(shiftReviewDate(selectedDate, -1, today))} aria-label="查看前一天">
          <ChevronLeft size={17} />
        </button>
        <label className="review-date-field">
          <CalendarDays size={15} />
          <span className="review-date-label">回顾日期</span>
          <input type="date" value={selectedDate} max={today} onInput={(event) => { const date = event.currentTarget.value; if (!date) return; if (isReviewDateAllowed(date, today)) selectDate(date); else event.currentTarget.value = selectedDate; }} onChange={(event) => selectDate(event.target.value)} aria-label="选择回顾日期" />
        </label>
        <button className="review-date-button" type="button" disabled={isToday} onClick={() => selectDate(shiftReviewDate(selectedDate, 1, today))} aria-label={isToday ? "已是今天，不能查看未来日期" : "查看后一天"} title={isToday ? "回顾只能查看今天和历史日期" : "查看后一天"}>
          <ChevronRight size={17} />
        </button>
      </div>

      <FocusTrendSection selectedDate={selectedDate} latestDate={today} focusSessions={focusSessions} />

      <div className="review-section-heading">
        <div>
          <span className="section-kicker"><NotebookText size={15} />当天记录</span>
          <h2>{formatReviewDate(selectedDate)}</h2>
        </div>
        <span className="review-record-state">{overview.hasRecords ? "已有本地记录" : "暂无本地记录"}</span>
      </div>

      <div className="review-overview-grid">
        <article className="review-overview-card">
          <span className="review-overview-icon task"><ClipboardList size={18} /></span>
          <span className="review-overview-copy"><small>任务记录</small><strong>{overview.taskCount} 项</strong><span>{overview.completedTaskCount} 项已完成</span></span>
        </article>
        <article className="review-overview-card">
          <span className="review-overview-icon focus"><Clock3 size={18} /></span>
          <span className="review-overview-copy"><small>专注记录</small><strong>{overview.focusSessionCount} 段</strong><span>按开始时间归入当天</span></span>
        </article>
        <article className="review-overview-card">
          <span className="review-overview-icon reading"><BookOpenText size={18} /></span>
          <span className="review-overview-copy"><small>阅读行动</small><strong>{overview.readingActionCount} 次</strong><span>成功打开文章的记录</span></span>
        </article>
        <article className="review-overview-card">
          <span className="review-overview-icon reflection"><NotebookText size={18} /></span>
          <span className="review-overview-copy"><small>每日回顾</small><strong>{overview.hasReflection ? "已保存" : "未填写"}</strong><span>本机每日回顾记录</span></span>
        </article>
      </div>

      <DailyReflectionSection date={selectedDate} reflection={selectedReflection} onSave={onSaveReflection} />

      {overview.hasRecords ? (
        <>
          <p className="review-fact-note">这里只呈现已经保存在本机的事实，不会把记录数量换算成单一效率评分。</p>
          <DailyStats stats={dailyStats} />
          <DailyTimeline items={timelineItems} />
        </>
      ) : (
        <div className="review-empty-state">
          <CalendarDays size={28} />
          <strong>这一天还没有记录</strong>
          <span>完成任务或专注后，行动事实会汇入对应日期。</span>
          <button type="button" onClick={onGoToTasks}>返回待办安排任务</button>
        </div>
      )}
    </section>
  );
}
