import { CalendarDays, Check, CheckCircle2, Circle, Flag, ListFilter, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import "./TaskSection.css";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import type { Task, TaskFilter } from "../types";

interface TaskSectionProps {
  filter: TaskFilter;
  visibleTasks: Task[];
  progress: number;
  onFilterChange: (filter: TaskFilter) => void;
  onCreateTask: () => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

const todayLabel = new Intl.DateTimeFormat("zh-CN", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

export function TaskSection({
  filter,
  visibleTasks,
  progress,
  onFilterChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onEditTask,
}: TaskSectionProps) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const filterLabels = { all: "全部", pending: "待完成", completed: "已完成" } as const;

  return (
    <section className="task-column">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>今天</h1>
        </div>
        <div
          className="progress-ring"
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

      <button className="task-create-trigger" type="button" onClick={onCreateTask}>
        <span className="task-create-icon"><Plus size={20} /></span>
        <span className="task-create-copy"><strong>添加任务</strong><small>打开完整任务编辑器</small></span>
        <span className="task-create-fields"><span><Flag size={12} />优先级</span><span><CalendarDays size={12} />日期</span></span>
      </button>

      <div className="list-header">
        <div className="task-filter-control">
          <button className="filter-trigger" type="button" aria-label="筛选任务" aria-expanded={filterMenuOpen} title="筛选任务" onClick={() => setFilterMenuOpen((open) => !open)}>
            <ListFilter size={16} />
          </button>
          {filterMenuOpen && <div className="filter-menu" role="menu" aria-label="任务筛选"><span className="filter-menu-label">筛选任务</span>{(Object.keys(filterLabels) as TaskFilter[]).map((item) => <button key={item} className={filter === item ? "filter-option active" : "filter-option"} type="button" role="menuitemradio" aria-checked={filter === item} onClick={() => { onFilterChange(item); setFilterMenuOpen(false); }}>{filterLabels[item]}{filter === item && <Check size={14} />}</button>)}</div>}
        </div>
        <span className="task-count">{visibleTasks.length} 项事项</span>
      </div>
      <div className="task-list">
        {visibleTasks.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={28} />
            <strong>这里暂时没有事项</strong>
            <span>添加一件小事，开始你的节奏。</span>
          </div>
        ) : (
          visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggleTask}
              onDelete={setPendingDelete}
              onEdit={onEditTask}
            />
          ))
        )}
      </div>
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
  onToggle: (id: string) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  return (
    <article className={task.completed ? "task-item completed" : "task-item"}>
      <button
        type="button"
        className="check-button"
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? "标记为未完成" : "完成事项"}
      >
        {task.completed ? <Check size={15} /> : <Circle size={19} />}
      </button>
      <div className="task-body">
        <div className="task-title-row">
          <button className="task-title-button" type="button" onClick={() => onEdit(task)} title="编辑任务">{task.title}</button>
          <span className={`priority-line ${task.priority}`} />
        </div>
      </div>
      <button className="edit-button" type="button" onClick={() => onEdit(task)} aria-label="编辑任务" title="编辑任务">
        <Pencil size={15} />
      </button>
      <button
        type="button"
        className="delete-button"
        onClick={() => onDelete(task)}
        aria-label="删除事项"
      >
        <Trash2 size={16} />
      </button>
    </article>
  );
}
