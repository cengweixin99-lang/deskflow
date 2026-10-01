import {
  BookOpenText,
  LayoutDashboard,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import "./Sidebar.css";

export type AppSection = "tasks" | "review" | "focus";

interface SidebarProps {
  collapsed: boolean;
  activeSection: AppSection;
  onSelect: (section: AppSection) => void;
  onToggle: () => void;
}

export function Sidebar({ collapsed, activeSection, onSelect, onToggle }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Sparkles size={16} /></span>
        <span className="brand-name">DeskFlow</span>
      </div>

      <nav className="primary-nav" aria-label="主导航">
        <button className={activeSection === "tasks" ? "nav-item active" : "nav-item"} type="button" onClick={() => onSelect("tasks")} aria-current={activeSection === "tasks" ? "page" : undefined} title="待办"><LayoutDashboard size={18} /><span className="nav-label">待办</span></button>
        <button className={activeSection === "review" ? "nav-item active" : "nav-item"} type="button" onClick={() => onSelect("review")} aria-current={activeSection === "review" ? "page" : undefined} title="回顾"><NotebookText size={18} /><span className="nav-label">回顾</span></button>
        <button className={activeSection === "focus" ? "nav-item active" : "nav-item"} type="button" onClick={() => onSelect("focus")} aria-current={activeSection === "focus" ? "page" : undefined} title="聚焦"><BookOpenText size={18} /><span className="nav-label">聚焦</span></button>
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-toggle" type="button" onClick={onToggle} aria-label={collapsed ? "展开侧栏" : "折叠侧栏"} title={collapsed ? "展开侧栏" : "折叠侧栏"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span className="sidebar-toggle-label">{collapsed ? "展开侧栏" : "折叠侧栏"}</span>
        </button>
      </div>
    </aside>
  );
}
