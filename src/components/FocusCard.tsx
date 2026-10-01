import { Pause, Play, RotateCcw, Target } from "lucide-react";
import "./FocusCard.css";
import type { TimerMode } from "../types";

interface FocusCardProps { timerMode: TimerMode; secondsLeft: number; timerRunning: boolean; onModeChange: (mode: TimerMode) => void; onReset: () => void; onToggle: () => void; }

export function FocusCard({ timerMode, secondsLeft, timerRunning, onModeChange, onReset, onToggle }: FocusCardProps) {
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  return <section className="focus-card"><div className="card-heading"><div><span className="section-kicker"><Target size={15} />专注时段</span><h2>{timerMode === "focus" ? "专注工作" : "短暂休息"}</h2></div><button className="icon-button subtle" aria-label="重置计时器" onClick={onReset}><RotateCcw size={17} /></button></div><div className="timer-display"><span>{minutes}</span><b>:</b><span>{seconds}</span></div><div className="timer-mode"><button className={timerMode === "focus" ? "selected" : ""} onClick={() => onModeChange("focus")}>专注 25</button><button className={timerMode === "break" ? "selected" : ""} onClick={() => onModeChange("break")}>休息 5</button></div><button className="timer-button" onClick={onToggle}>{timerRunning ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}<span>{timerRunning ? "暂停计时" : "开始专注"}</span></button></section>;
}
