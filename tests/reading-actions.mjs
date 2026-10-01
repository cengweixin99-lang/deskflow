import assert from "node:assert/strict";
import test from "node:test";
import { createReadingAction, recordArticleOpen } from "../src/features/reader/readingActions.ts";

test("reading actions keep article and feed snapshots at open time", () => {
  const article = {
    id: "article-1",
    feedId: "feed-1",
    title: "把阅读转成行动",
    link: "https://example.com/action",
    excerpt: "",
    author: "",
    publishedAt: "2026-09-30T08:00:00.000Z",
    read: false,
    saved: false,
  };
  const feed = {
    id: "feed-1",
    title: "示例来源",
    url: "https://example.com/feed",
    siteUrl: "https://example.com",
    description: "",
    lastFetched: null,
    lastError: null,
  };

  assert.deepEqual(createReadingAction({
    id: "action-1",
    article,
    feed,
    openedAt: "2026-10-02T08:30:00.000Z",
  }), {
    id: "action-1",
    articleId: "article-1",
    articleTitle: "把阅读转成行动",
    articleLink: "https://example.com/action",
    feedId: "feed-1",
    feedTitle: "示例来源",
    openedAt: "2026-10-02T08:30:00.000Z",
  });
});

test("reading actions keep an empty source snapshot when the feed is unavailable", () => {
  const article = {
    id: "article-1",
    feedId: "missing-feed",
    title: "离线文章",
    link: "https://example.com/offline",
    excerpt: "",
    author: "",
    publishedAt: "2026-09-30T08:00:00.000Z",
    read: true,
    saved: false,
  };
  const action = createReadingAction({ id: "action-1", article, feed: undefined, openedAt: "2026-10-02T08:30:00.000Z" });

  assert.equal(action.feedTitle, "");
  assert.equal(action.articleTitle, "离线文章");
});

test("recording a successful article open marks it read and prepends a new action", () => {
  const article = {
    id: "article-1",
    feedId: "feed-1",
    title: "阅读记录",
    link: "https://example.com/read",
    excerpt: "",
    author: "",
    publishedAt: "2026-09-30T08:00:00.000Z",
    read: false,
    saved: false,
  };
  const previousAction = { id: "older", articleId: "older", articleTitle: "旧记录", articleLink: "", feedId: "", feedTitle: "", openedAt: "2026-10-01T08:00:00.000Z" };
  const result = recordArticleOpen({
    articleId: article.id,
    actionId: "new-action",
    openedAt: "2026-10-02T08:00:00.000Z",
    articles: [article],
    feeds: [],
    readingActions: [previousAction],
  });

  assert.equal(result.articles[0].read, true);
  assert.deepEqual(result.readingActions.map((action) => action.id), ["new-action", "older"]);
});

test("recording an unknown article leaves existing state references unchanged", () => {
  const articles = [];
  const readingActions = [];
  const result = recordArticleOpen({ articleId: "missing", actionId: "unused", openedAt: "2026-10-02T08:00:00.000Z", articles, feeds: [], readingActions });

  assert.equal(result.articles, articles);
  assert.equal(result.readingActions, readingActions);
});
