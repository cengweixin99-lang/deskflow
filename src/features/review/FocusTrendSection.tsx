import { ChartColumn, Clock3 } from "lucide-react";
import { useMemo, useState } from "react";
import type { FocusSession } from "../../types";
import { formatTimerDuration } from "../focus/timer";
import { getFocusTrend, type FocusTrendBucket, type FocusTrendRange } from "./focusTrends";

interface FocusTrendSectionProps {
  selectedDate: string;
  latestDate: string;
  focusSessions: FocusSession[];
}

const RANGE_OPTIONS: { value: FocusTrendRange; label: string }[] = [
  { value: "day", label: "当天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
];

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function formatShortDate(dateKey: string, includeYear = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    ...(includeYear ? { year: "numeric" as const } : {}),
    month: "numeric",
    day: "numeric",
  }).format(parseDateKey(dateKey));
}

function formatTrendRange(range: FocusTrendRange, startDate: string, endDate: string) {
  if (range === "day") return formatShortDate(startDate, true);
  if (range === "month") {
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(parseDateKey(startDate));
  }
  return `${formatShortDate(startDate, true)} – ${formatShortDate(endDate, startDate.slice(0, 4) !== endDate.slice(0, 4))}`;
}

function formatTrendDuration(durationSeconds: number) {
  return durationSeconds === 0 ? "0 分钟" : formatTimerDuration(durationSeconds);
}

function getBucketLabel(bucket: FocusTrendBucket, range: FocusTrendRange) {
  if (range === "day" && bucket.startHour !== null) {
    const endHour = bucket.startHour + 4;
    return `${String(bucket.startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00`;
  }
  if (range === "week") {
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parseDateKey(bucket.date));
    return `${weekday} ${formatShortDate(bucket.date)}`;
  }
  return `${parseDateKey(bucket.date).getDate()}日`;
}

function getAxisLabel(bucket: FocusTrendBucket, range: FocusTrendRange, index: number, bucketCount: number) {
  if (range === "day") return `${bucket.startHour}时`;
  if (range === "week") return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parseDateKey(bucket.date));
  const day = parseDateKey(bucket.date).getDate();
  return index === 0 || index === bucketCount - 1 || day % 5 === 0 ? String(day) : "";
}

function getBucketUnit(range: FocusTrendRange) {
  return range === "day" ? "时段" : "天";
}

export function FocusTrendSection({ selectedDate, latestDate, focusSessions }: FocusTrendSectionProps) {
  const [range, setRange] = useState<FocusTrendRange>("day");
  const trend = useMemo(() => getFocusTrend({
    selectedDate,
    latestDate,
    range,
    focusSessions,
  }), [focusSessions, latestDate, range, selectedDate]);
  const maxDuration = Math.max(0, ...trend.buckets.map((bucket) => bucket.durationSeconds));
  const activeBuckets = trend.buckets.filter((bucket) => bucket.durationSeconds > 0);
  const futureBucketCount = trend.buckets.filter((bucket) => bucket.isFuture).length;
  const emptyReachedBucketCount = trend.buckets.length - activeBuckets.length - futureBucketCount;
  const rangeLabel = formatTrendRange(range, trend.startDate, trend.endDate);
  const bucketUnit = getBucketUnit(range);

  return (
    <section className="focus-trend-section" aria-labelledby="focus-trend-title">
      <div className="focus-trend-heading">
        <div>
          <span className="section-kicker"><ChartColumn size={15} />专注趋势</span>
          <h2 id="focus-trend-title">实际投入分布</h2>
        </div>
        <span>{rangeLabel}</span>
      </div>

      <div className="focus-trend-range" role="group" aria-label="选择专注趋势时间范围">
        {RANGE_OPTIONS.map((option) => (
          <button
            className={range === option.value ? "active" : ""}
            type="button"
            key={option.value}
            aria-pressed={range === option.value}
            onClick={() => setRange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="focus-trend-card">
        <div className="focus-trend-summary">
          <span className="focus-trend-summary-icon"><Clock3 size={19} /></span>
          <span className="focus-trend-summary-primary">
            <small>累计专注</small>
            <strong>{formatTrendDuration(trend.totalDurationSeconds)}</strong>
          </span>
          <span className="focus-trend-summary-fact"><strong>{trend.sessionCount}</strong><small>段已结束记录</small></span>
          <span className="focus-trend-summary-fact"><strong>{trend.activeBucketCount}</strong><small>个有投入{bucketUnit}</small></span>
        </div>

        {trend.sessionCount === 0 ? (
          <div className="focus-trend-empty">
            <ChartColumn size={25} />
            <strong>这个范围还没有专注记录</strong>
            <span>完成或提前结束一次专注后，实际投入会按开始时间显示在这里。</span>
          </div>
        ) : trend.totalDurationSeconds === 0 ? (
          <div className="focus-trend-empty">
            <Clock3 size={25} />
            <strong>已有记录，实际投入为 0 秒</strong>
            <span>这里只呈现记录中的实际时长，不根据记录次数推断投入。</span>
          </div>
        ) : (
          <>
            <figure className={`focus-trend-chart ${range}`} aria-labelledby="focus-trend-chart-title">
              <figcaption id="focus-trend-chart-title">
                <strong>专注时长分布</strong>
                <span>柱高按当前范围内的最大值缩放，精确时长见文字明细。{futureBucketCount > 0 ? "斜线区域尚未到达。" : ""}</span>
              </figcaption>
              <ol className="focus-trend-bars" style={{ gridTemplateColumns: `repeat(${trend.buckets.length}, minmax(0, 1fr))` }}>
                {trend.buckets.map((bucket, index) => {
                  const bucketLabel = getBucketLabel(bucket, range);
                  const barHeight = bucket.durationSeconds === 0 ? 0 : Math.max(5, (bucket.durationSeconds / maxDuration) * 100);
                  return (
                    <li className={bucket.isFuture ? "future" : ""} key={bucket.key} aria-label={bucket.isFuture ? `${bucketLabel}，尚未到达` : `${bucketLabel}，专注 ${formatTrendDuration(bucket.durationSeconds)}，${bucket.sessionCount} 段记录`} title={bucket.isFuture ? `${bucketLabel} · 尚未到达` : `${bucketLabel} · ${formatTrendDuration(bucket.durationSeconds)}`}>
                      <span className="focus-trend-bar-track" aria-hidden="true"><i style={{ height: `${barHeight}%` }} /></span>
                      <small aria-hidden="true">{getAxisLabel(bucket, range, index, trend.buckets.length)}</small>
                    </li>
                  );
                })}
              </ol>
            </figure>

            <details className="focus-trend-details">
              <summary>查看文字明细（{activeBuckets.length} 个有投入{bucketUnit}）</summary>
              <ul>
                {activeBuckets.map((bucket) => (
                  <li key={bucket.key}>
                    <span>{getBucketLabel(bucket, range)}</span>
                    <strong>{formatTrendDuration(bucket.durationSeconds)}</strong>
                    <small>{bucket.sessionCount} 段</small>
                  </li>
                ))}
              </ul>
              {emptyReachedBucketCount > 0 && <p>另有 {emptyReachedBucketCount} 个已到达{bucketUnit}没有实际投入记录。</p>}
              {futureBucketCount > 0 && <p>未来 {futureBucketCount} 个{bucketUnit}尚未到达，不计入投入统计。</p>}
            </details>
          </>
        )}
      </div>
      <p className="focus-trend-note">统计按专注开始时的本地日期归档，仅包含自然完成或提前结束的记录；未来日期会单独标记且不计入统计。</p>
    </section>
  );
}
