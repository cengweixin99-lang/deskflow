import { Check, CheckCircle2, Circle, FileText, ListFilter, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import "./TaskSection.css";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import type { Task, TaskFilter, TaskPriority } from "../types";

interface TaskSectionProps {
  filter: TaskFilter;
  visibleTasks: Task[];
  draft: string;
  priority: TaskPriority;
  progress: number;
  onFilterChange: (filter: TaskFilter) => void;
  onDraftChange: (value: string) => void;
  onPriorityChange: (priority: TaskPriority) => void;
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onOpenNotes: (task: Task) => void;
}

const todayLabel = new Intl.DateTimeFormat("zh-CN", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

export function TaskSection({
  filter,
  visibleTasks,
  draft,
  priority,
  progress,
  onFilterChange,
  onDraftChange,
  onPriorityChange,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onOpenNotes,
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

      <form className="quick-add" onSubmit={onAddTask}>
        <Plus size={20} />
        <input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="添加一件新事情..."
          aria-label="新任务"
        />
        <button type="submit">添加</button>
      </form>
      <div className="quick-options">
        <span>优先级</span>
        {(["high", "medium", "low"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={
              priority === item
                ? `priority-choice selected ${item}`
                : `priority-choice ${item}`
            }
            onClick={() => onPriorityChange(item)}
          >
            <i />
            {item === "high" ? "高" : item === "medium" ? "中" : "低"}
          </button>
        ))}
      </div>

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
              onOpenNotes={onOpenNotes}
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
  onOpenNotes,
}: {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (task: Task) => void;
  onOpenNotes: (task: Task) => void;
}) {
  return (
    <article className={task.completed ? "task-item completed" : "task-item"}>
      <button
        className="check-button"
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? "标记为未完成" : "完成事项"}
      >
        {task.completed ? <Check size={15} /> : <Circle size={19} />}
      </button>
      <div className="task-body">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className={`priority-line ${task.priority}`} />
        </div>
      </div>
      <button className="notes-button" onClick={() => onOpenNotes(task)} aria-label={task.notes ? "查看记录" : "添加记录"} title={task.notes ? "查看记录" : "添加记录"}>
        <FileText size={15} />
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
