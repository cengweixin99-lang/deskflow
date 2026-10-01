import type { FeedArticle, FeedSource, ReadingAction } from "../../types";

export function createReadingAction({
  id,
  article,
  feed,
  openedAt,
}: {
  id: string;
  article: FeedArticle;
  feed: FeedSource | undefined;
  openedAt: string;
}): ReadingAction {
  return {
    id,
    articleId: article.id,
    articleTitle: article.title,
    articleLink: article.link,
    feedId: article.feedId,
    feedTitle: feed?.title ?? "",
    openedAt,
  };
}

export function recordArticleOpen({
  articleId,
  actionId,
  openedAt,
  articles,
  feeds,
  readingActions,
}: {
  articleId: string;
  actionId: string;
  openedAt: string;
  articles: FeedArticle[];
  feeds: FeedSource[];
  readingActions: ReadingAction[];
}) {
  const article = articles.find((item) => item.id === articleId);
  if (!article) return { articles, readingActions };
  const action = createReadingAction({
    id: actionId,
    article,
    feed: feeds.find((feed) => feed.id === article.feedId),
    openedAt,
  });
  return {
    articles: articles.map((item) => item.id === articleId ? { ...item, read: true } : item),
    readingActions: [action, ...readingActions],
  };
}
