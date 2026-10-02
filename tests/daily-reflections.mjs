import assert from "node:assert/strict";
import test from "node:test";
import { createDailyReflection, replaceDailyReflection, restoreDailyReflection } from "../src/features/review/reflections.ts";

const savedAt = "2026-10-02T08:00:00.000Z";

test("daily reflections accept partial input and trim the saved summary", () => {
  const reflection = createDailyReflection({
    date: "2026-10-02",
    summary: "  今天完成了统计验收。  ",
    energy: 4,
    satisfaction: null,
  }, savedAt, "2026-10-02");

  assert.deepEqual(reflection, {
    date: "2026-10-02",
    summary: "今天完成了统计验收。",
    energy: 4,
    satisfaction: null,
    updatedAt: savedAt,
  });
});

test("daily reflections reject empty, future, invalid score, and overlong input", () => {
  assert.equal(createDailyReflection({
    date: "2026-10-02",
    summary: "  ",
    energy: null,
    satisfaction: null,
  }, savedAt, "2026-10-02"), null);
  assert.equal(createDailyReflection({
    date: "2026-10-03",
    summary: "未来",
    energy: null,
    satisfaction: null,
  }, savedAt, "2026-10-02"), null);
  assert.equal(createDailyReflection({
    date: "2026-10-02",
    summary: "评分异常",
    energy: 6,
    satisfaction: null,
  }, savedAt, "2026-10-02"), null);
  assert.equal(createDailyReflection({
    date: "2026-10-02",
    summary: "字".repeat(1001),
    energy: null,
    satisfaction: null,
  }, savedAt, "2026-10-02"), null);
});

test("replacing a daily reflection keeps one record per date", () => {
  const previous = {
    date: "2026-10-02",
    summary: "旧总结",
    energy: 3,
    satisfaction: 3,
    updatedAt: "2026-10-02T07:00:00.000Z",
  };
  const replacement = {
    ...previous,
    summary: "新总结",
    updatedAt: savedAt,
  };
  const other = {
    ...previous,
    date: "2026-10-01",
  };

  assert.deepEqual(replaceDailyReflection([previous, other], replacement), [replacement, other]);
});

test("undo restores an edited reflection or removes a newly created one", () => {
  const previous = {
    date: "2026-10-02",
    summary: "旧总结",
    energy: 3,
    satisfaction: 3,
    updatedAt: "2026-10-02T07:00:00.000Z",
  };
  const current = {
    ...previous,
    summary: "新总结",
    updatedAt: savedAt,
  };

  assert.deepEqual(restoreDailyReflection([current], current.date, previous), [previous]);
  assert.deepEqual(restoreDailyReflection([current], current.date, null), []);
});
