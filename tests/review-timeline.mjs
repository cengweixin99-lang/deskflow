import assert from "node:assert/strict";
import test from "node:test";
import { getDailyTimelineItems } from "../src/features/review/timeline.ts";

function localTimestamp(year, month, day, hour, minute = 0) {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

test("daily timeline keeps planned tasks first and sorts timed actions chronologically", () => {
  const items = getDailyTimelineItems({
    date: "2026-10-02",
    tasks: [{ id: "task-1", title: "当天计划", createdAt: localTimestamp(2026, 10, 1, 9), completed: true, priority: "high", date: "2026-10-02", notes: "" }],
    focusSessions: [
      { id: "focus-late", taskId: null, taskTitle: "", startedAt: localTimestamp(2026, 10, 2, 15), endedAt: localTimestamp(2026, 10, 2, 15, 25), durationSeconds: 1500, status: "completed", note: "" },
      { id: "focus-early", taskId: "task-1", taskTitle: "当天计划", startedAt: localTimestamp(2026, 10, 2, 9), endedAt: localTimestamp(2026, 10, 2, 9, 10), durationSeconds: 600, status: "stopped", note: "先完成一部分" },
    ],
    readingActions: [{ id: "read-1", articleId: "article-1", articleTitle: "阅读记录", articleLink: "https://example.com", feedId: "feed-1", feedTitle: "示例来源", openedAt: localTimestamp(2026, 10, 2, 11) }],
  });

  assert.deepEqual(items.map((item) => item.id), ["task:task-1", "focus:focus-early", "reading:read-1", "focus:focus-late"]);
  assert.equal(items[0].occurredAt, null);
});

test("daily timeline excludes other dates and keeps deleted-source reading snapshots", () => {
  const items = getDailyTimelineItems({
    date: "2026-10-02",
    tasks: [],
    focusSessions: [{ id: "focus-old", taskId: null, taskTitle: "", startedAt: localTimestamp(2026, 10, 1, 23), endedAt: localTimestamp(2026, 10, 2, 0), durationSeconds: 3600, status: "completed", note: "" }],
    readingActions: [{ id: "read-1", articleId: "deleted-article", articleTitle: "仍然保留的标题", articleLink: "", feedId: "deleted-feed", feedTitle: "已删除来源", openedAt: localTimestamp(2026, 10, 2, 8) }],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "reading");
  if (items[0].kind === "reading") assert.equal(items[0].action.feedTitle, "已删除来源");
});
