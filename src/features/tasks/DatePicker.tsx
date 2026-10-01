import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { formatDateLabel, getDateKey } from "../../types";
import "./DatePicker.css";

const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

interface DatePickerProps {
  value: string;
  min?: string;
  labelId: string;
  describedBy?: string;
  invalid?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  onChange: (date: string) => void;
}

function parseDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return getDateKey(date) === dateKey ? date : null;
}

function getInitialMonth(value: string, min?: string) {
  const date = parseDateKey(value) ?? (min ? parseDateKey(min) : null) ?? new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function DatePicker({ value, min, labelId, describedBy, invalid = false, buttonRef, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [displayDate, setDisplayDate] = useState(() => getInitialMonth(value, min));
  const rootRef = useRef<HTMLDivElement>(null);
  const internalButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const triggerValueId = useId();
  const todayKey = getDateKey();
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const calendarDays = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => index < firstDayOffset ? null : index - firstDayOffset + 1);
  const minimumMonth = min?.slice(0, 7);
  const displayMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const previousMonthDisabled = Boolean(minimumMonth && displayMonth <= minimumMonth);
  const shortcutDate = min && todayKey < min ? min : todayKey;

  function setTriggerRef(element: HTMLButtonElement | null) {
    internalButtonRef.current = element;
    if (buttonRef) buttonRef.current = element;
  }

  function focusPreferredDay() {
    requestAnimationFrame(() => {
      const preferredDate = value.startsWith(`${displayMonth}-`) && (!min || value >= min)
        ? value
        : todayKey.startsWith(`${displayMonth}-`) && (!min || todayKey >= min)
          ? todayKey
          : "";
      const preferredButton = preferredDate
        ? panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${preferredDate}"]`)
        : null;
      (preferredButton ?? panelRef.current?.querySelector<HTMLButtonElement>(".date-picker-day:not(:disabled)"))?.focus();
    });
  }

  function openPicker() {
    setDisplayDate(getInitialMonth(value, min));
    setOpen(true);
  }

  function closePicker(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => internalButtonRef.current?.focus());
  }

  function chooseDate(dateKey: string) {
    onChange(dateKey);
    closePicker();
  }

  function shiftMonth(offset: number) {
    setDisplayDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function moveDayFocus(dateKey: string, offset: number) {
    const date = parseDateKey(dateKey);
    if (!date) return;
    date.setDate(date.getDate() + offset);
    const nextDateKey = getDateKey(date);
    if (min && nextDateKey < min) return;
    setDisplayDate(new Date(date.getFullYear(), date.getMonth(), 1));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>(`[data-date="${nextDateKey}"]`)?.focus());
    });
  }

  function handleDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, dateKey: string) {
    const date = parseDateKey(dateKey);
    if (!date) return;
    const weekOffset = (date.getDay() + 6) % 7;
    const offset = event.key === "ArrowLeft" ? -1
      : event.key === "ArrowRight" ? 1
        : event.key === "ArrowUp" ? -7
          : event.key === "ArrowDown" ? 7
            : event.key === "Home" ? -weekOffset
              : event.key === "End" ? 6 - weekOffset
                : null;
    if (offset === null) return;
    event.preventDefault();
    moveDayFocus(dateKey, offset);
  }

  useEffect(() => {
    if (!open) return;
    focusPreferredDay();
  }, [displayMonth, open]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closePicker(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closePicker();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) openPicker();
  }

  return (
    <div className={`date-picker${open ? " open" : ""}`} ref={rootRef}>
      <button
        ref={setTriggerRef}
        className="date-picker-trigger"
        type="button"
        aria-labelledby={`${labelId} ${triggerValueId}`}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-invalid={invalid || undefined}
        onClick={() => open ? closePicker(false) : openPicker()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span id={triggerValueId}>{value ? formatDateLabel(value) : "选择日期"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="date-picker-panel" id={panelId} ref={panelRef} role="dialog" aria-modal="false" aria-label="选择任务日期">
          <div className="date-picker-heading">
            <strong>{year}年{month + 1}月</strong>
            <div>
              <button type="button" disabled={previousMonthDisabled} onClick={() => shiftMonth(-1)} aria-label="上个月"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月"><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="date-picker-weekdays" aria-hidden="true">
            {weekLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="date-picker-grid">
            {calendarDays.map((day, index) => {
              if (day === null) return <span className="date-picker-day empty" key={`empty-${index}`} />;
              const dateKey = `${displayMonth}-${String(day).padStart(2, "0")}`;
              const disabled = Boolean(min && dateKey < min);
              const selected = dateKey === value;
              const today = dateKey === todayKey;
              return (
                <button
                  className={`date-picker-day${selected ? " selected" : ""}${today ? " today" : ""}`}
                  type="button"
                  key={dateKey}
                  data-date={dateKey}
                  disabled={disabled}
                  aria-label={`${formatDateLabel(dateKey)}${selected ? "，已选择" : ""}`}
                  aria-current={today ? "date" : undefined}
                  onClick={() => chooseDate(dateKey)}
                  onKeyDown={(event) => handleDayKeyDown(event, dateKey)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="date-picker-footer">
            <span>{value ? `已选 ${formatDateLabel(value)}` : "请选择一天"}</span>
            <button type="button" onClick={() => chooseDate(shortcutDate)}>{shortcutDate === todayKey ? "今天" : "最早可选"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
