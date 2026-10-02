import { CalendarClock, Check, CheckCircle2, Circle, ListFilter, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import "./TaskSection.css";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { PostponeTaskModal } from "./PostponeTaskModal";
import { getDateKey } from "../../types";
import type { Task, TaskFilter } from "../../types";

interface TaskSectionProps {
  filter: TaskFilter;
  filterCounts: Record<TaskFilter, number>;
  visibleTasks: Task[];
  progress: number;
  onFilterChange: (filter: TaskFilter) => void;
  onCreateTask: (initialDate: string) => void;
  onToggleTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onPostponeTask: (task: Task, date: string) => void;
}

const filterLabels: Record<TaskFilter, string> = {
  all: "全部",
  pending: "待完成",
  completed: "已完成",
};

const emptyStateLabels: Record<TaskFilter, string> = {
  all: "今天没有 TODO",
  pending: "今天没有待完成 TODO",
  completed: "今天没有已完成 TODO",
};

export function TaskSection({
  filter,
  filterCounts,
  visibleTasks,
  progress,
  onFilterChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
  onPostponeTask,
}: TaskSectionProps) {
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [pendingPostpone, setPendingPostpone] = useState<Task | null>(null);
  const todayLabel = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <section className="task-column">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>今天</h1>
        </div>
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
      </div>

      <button className="task-create-trigger" type="button" onClick={() => onCreateTask(getDateKey())}>
        <Plus size={19} />
        <span>添加 TODO</span>
      </button>

      <div className="task-list-toolbar">
        <label className={filter === "all" ? "task-filter-control" : "task-filter-control active"} title={`筛选：${filterLabels[filter]}`}>
          <ListFilter size={17} aria-hidden="true" />
          <select
            value={filter}
            aria-label={`筛选今天的 TODO，当前：${filterLabels[filter]}`}
            onChange={(event) => onFilterChange(event.target.value as TaskFilter)}
          >
            {(Object.keys(filterLabels) as TaskFilter[]).map((item) => (
              <option key={item} value={item}>{filterLabels[item]}（{filterCounts[item]}）</option>
            ))}
          </select>
        </label>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={28} />
          <strong>{emptyStateLabels[filter]}</strong>
        </div>
      ) : (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={onToggleTask} onDelete={setPendingDelete} onEdit={onEditTask} onPostpone={setPendingPostpone} />
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
      {pendingPostpone && (
        <PostponeTaskModal
          task={pendingPostpone}
          onCancel={() => setPendingPostpone(null)}
          onConfirm={(date) => onPostponeTask(pendingPostpone, date)}
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
  onPostpone,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onPostpone: (task: Task) => void;
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
          <button className="task-title-button" type="button" onClick={() => onEdit(task)} title="查看任务详情">{task.title}</button>
          <span className={`priority-line ${task.priority}`} />
        </div>
      </div>
      <div className="task-actions">
        {!task.completed && <button className="task-action-button postpone-button" type="button" onClick={() => onPostpone(task)} aria-label={`推迟“${task.title}”`} title="推迟任务"><CalendarClock size={15} /></button>}
        <button className="task-action-button edit-button" type="button" onClick={() => onEdit(task)} aria-label={`编辑“${task.title}”`} title="编辑任务">
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="task-action-button delete-button"
          onClick={() => onDelete(task)}
          aria-label={`删除“${task.title}”`}
          title="删除任务"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}
