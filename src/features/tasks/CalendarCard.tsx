import { CalendarDays, CalendarSearch, CheckCircle2, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import "./CalendarCard.css";
import { getDateKey } from "../../types";
import type { Task } from "../../types";

const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

interface CalendarCardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenReview: (date: string) => void;
}

export function CalendarCard({ tasks, onSelectTask, onOpenReview }: CalendarCardProps) {
  const today = new Date();
  const todayKey = getDateKey(today);
  const [displayDate, setDisplayDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendarDays = useMemo(() => Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => index < firstDayOffset ? null : index - firstDayOffset + 1), [daysInMonth, firstDayOffset]);
  const selectedTasks = selectedDate ? tasks.filter((task) => task.date === selectedDate) : [];
  const selectedLabel = selectedDate ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(`${selectedDate}T00:00:00`)) : "";
  const reviewAvailable = selectedDate !== null && selectedDate <= todayKey;

  function shiftMonth(offset: number) {
    setDisplayDate(new Date(year, month + offset, 1));
    setSelectedDate(null);
  }

  function selectDate(dateKey: string) {
    setSelectedDate((current) => current === dateKey ? null : dateKey);
  }

  return (
    <section className="calendar-card">
      <div className="calendar-heading">
        <div><span className="section-kicker"><CalendarDays size={15} />日历</span><h2>{year}年{month + 1}月</h2></div>
        <div className="calendar-actions"><button className="calendar-nav" type="button" onClick={() => shiftMonth(-1)} aria-label="上个月"><ChevronLeft size={16} /></button><button className="calendar-nav" type="button" onClick={() => shiftMonth(1)} aria-label="下个月"><ChevronRight size={16} /></button></div>
      </div>
      <div className="calendar-weekdays">{weekLabels.map((label) => <span key={label}>{label}</span>)}</div>
      <div className="calendar-grid">
        {calendarDays.map((day, index) => {
          if (day === null) return <span key={`${year}-${month}-${index}`} className="calendar-day empty" />;
          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const hasTasks = tasks.some((task) => task.date === dateKey);
          return <button key={dateKey} className={`calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}`} type="button" onClick={() => selectDate(dateKey)} aria-label={`查看${year}年${month + 1}月${day}日的记录`} aria-pressed={isSelected}><span>{day}</span>{hasTasks && <i className="calendar-dot visible" />}</button>;
        })}
      </div>
      {selectedDate && (
        <div className="history-popover">
          <div className="history-heading">
            <strong>{selectedLabel} · {selectedTasks.length} 项</strong>
            <span>选择任务可编辑</span>
          </div>
          <div className="history-review-action">
            <button className="history-review-button" type="button" disabled={!reviewAvailable} aria-describedby={reviewAvailable ? undefined : "calendar-review-unavailable"} onClick={() => { if (selectedDate && reviewAvailable) onOpenReview(selectedDate); }}>
              <CalendarSearch size={14} />查看完整回顾
            </button>
            {!reviewAvailable && <span id="calendar-review-unavailable">未来日期到当天后可查看完整回顾。</span>}
          </div>
          {selectedTasks.length === 0 ? (
            <p className="history-empty">这一天没有任务记录</p>
          ) : (
            <div className="history-list">
              {selectedTasks.map((task) => (
                <button key={task.id} className="history-item" type="button" onClick={() => onSelectTask(task)}>
                  {task.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  <span>{task.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
