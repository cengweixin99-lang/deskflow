import { CalendarDays, Check, CheckCircle2, Circle, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import "./TaskSection.css";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { formatDateLabel, getDateKey } from "../../types";
import type { Task, TaskView } from "../../types";

interface TaskSectionProps {
  view: TaskView;
  viewCounts: Record<TaskView, number>;
  visibleTasks: Task[];
  progress: number;
  onViewChange: (view: TaskView) => void;
  onCreateTask: (initialDate: string) => void;
  onToggleTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

const viewLabels: Record<TaskView, string> = {
  today: "今天",
  upcoming: "即将到来",
  completed: "已完成",
};

const viewDescriptions: Record<TaskView, string> = {
  today: "今天的计划",
  upcoming: "未来安排",
  completed: "完成记录",
};

const emptyStateCopy: Record<TaskView, { title: string; detail: string }> = {
  today: {
    title: "今天还没有安排",
    detail: "添加一件想完成的事，为今天定下意图。",
  },
  upcoming: {
    title: "接下来还没有安排",
    detail: "添加任务并选择未来日期，提前留出注意力。",
  },
  completed: {
    title: "还没有已完成任务",
    detail: "完成的任务会保留在这里，成为行动记录。",
  },
};

function getTomorrowDateKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateKey(tomorrow);
}

function groupTasksByDate(tasks: Task[]) {
  const groups = new Map<string, Task[]>();
  tasks.forEach((task) => {
    const group = groups.get(task.date) ?? [];
    group.push(task);
    groups.set(task.date, group);
  });
  return Array.from(groups, ([date, groupTasks]) => ({ date, tasks: groupTasks }));
}

export function TaskSection({
  view,
  viewCounts,
  visibleTasks,
  progress,
  onViewChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
}: TaskSectionProps) {
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const todayLabel = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const groupedTasks = view === "today" ? [] : groupTasksByDate(visibleTasks);
  const initialDate = view === "upcoming" ? getTomorrowDateKey() : getDateKey();
  const createTitle = view === "upcoming" ? "添加未来任务" : "添加任务";
  const createDetail = view === "upcoming" ? "默认安排到明天，可在编辑器中调整" : "打开完整任务编辑器";

  return (
    <section className="task-column">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{view === "today" ? todayLabel : viewDescriptions[view]}</p>
          <h1>{viewLabels[view]}</h1>
        </div>
        {view === "today" ? (
          <div
            className="progress-ring"
            aria-label={`今天的任务已完成 ${progress}%`}
            style={
              { "--progress": `${progress * 3.6}deg` } as React.CSSProperties & {
                "--progress": string;
              }
            }
          >
            <span>
              {progress}
              <small>%</small>
            </span>
          </div>
        ) : (
          <div className="task-view-summary" aria-label={`${viewLabels[view]}共 ${visibleTasks.length} 项任务`}>
            <strong>{visibleTasks.length}</strong>
            <small>项任务</small>
          </div>
        )}
      </div>

      <nav className="task-view-tabs" aria-label="任务视图">
        {(Object.keys(viewLabels) as TaskView[]).map((item) => (
          <button
            key={item}
            className={view === item ? "task-view-tab active" : "task-view-tab"}
            type="button"
            aria-current={view === item ? "page" : undefined}
            onClick={() => onViewChange(item)}
          >
            <span>{viewLabels[item]}</span>
            <small>{viewCounts[item]}</small>
          </button>
        ))}
      </nav>

      <button className="task-create-trigger" type="button" onClick={() => onCreateTask(initialDate)}>
        <span className="task-create-icon"><Plus size={20} /></span>
        <span className="task-create-copy"><strong>{createTitle}</strong><small>{createDetail}</small></span>
        <span className="task-create-fields"><span><Flag size={12} />优先级</span><span><CalendarDays size={12} />日期</span></span>
      </button>

      <div className="list-header">
        <span className="task-list-label">{view === "today" ? "今日事项" : view === "upcoming" ? "按计划日期" : "按任务日期"}</span>
        <span className="task-count">{visibleTasks.length} 项事项</span>
      </div>
      {visibleTasks.length === 0 ? (
        <div className="empty-state">
          {view === "upcoming" ? <CalendarDays size={28} /> : <CheckCircle2 size={28} />}
          <strong>{emptyStateCopy[view].title}</strong>
          <span>{emptyStateCopy[view].detail}</span>
        </div>
      ) : view === "today" ? (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={onToggleTask} onDelete={setPendingDelete} onEdit={onEditTask} />
          ))}
        </div>
      ) : (
        <div className="task-date-groups">
          {groupedTasks.map((group) => (
            <section className="task-date-group" key={group.date} aria-labelledby={`task-date-${group.date}`}>
              <div className="task-date-heading">
                <h2 id={`task-date-${group.date}`}>{formatDateLabel(group.date)}</h2>
                <span>{group.tasks.length} 项</span>
              </div>
              <div className="task-list">
                {group.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} onToggle={onToggleTask} onDelete={setPendingDelete} onEdit={onEditTask} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {pendingDelete && (
        <DeleteConfirmModal
          task={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDeleteTask(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
    </section>
  );
}

function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <article className={task.completed ? "task-item completed" : "task-item"}>
      <button
        type="button"
        className="check-button"
        onClick={() => onToggle(task)}
        aria-label={task.completed ? `将“${task.title}”标记为未完成` : `完成“${task.title}”`}
      >
        {task.completed ? <Check size={15} /> : <Circle size={19} />}
      </button>
      <div className="task-body">
        <div className="task-title-row">
          <button className="task-title-button" type="button" onClick={() => onEdit(task)} title="编辑任务">{task.title}</button>
          <span className={`priority-line ${task.priority}`} />
        </div>
      </div>
      <button className="edit-button" type="button" onClick={() => onEdit(task)} aria-label={`编辑“${task.title}”`} title="编辑任务">
        <Pencil size={15} />
      </button>
      <button
        type="button"
        className="delete-button"
        onClick={() => onDelete(task)}
        aria-label={`删除“${task.title}”`}
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}
