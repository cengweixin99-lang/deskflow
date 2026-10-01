import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Folder,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Rss,
  Search,
  Trash2,
  X,
} from "lucide-react";
import "./FocusReader.css";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import type { FeedArticle, FeedGroup, FeedSource, FocusFilter } from "../../types";

interface FocusReaderProps {
  feeds: FeedSource[];
  groups: FeedGroup[];
  articles: FeedArticle[];
  feedsBusy: boolean;
  subscribing: boolean;
  onSubscribe: (url: string) => Promise<string>;
  onRefresh: (feedId?: string) => Promise<void>;
  onRemoveFeed: (id: string) => void;
  onUpdateArticle: (id: string, patch: Partial<Pick<FeedArticle, "read" | "saved">>) => void;
  onOpenArticle: (id: string) => void;
  onAddGroup: (name: string) => string;
  onRenameGroup: (id: string, name: string) => void;
  onRemoveGroup: (id: string) => void;
  onSetFeedGroup: (feedId: string, groupId: string | null) => void;
}

const UNGROUPED_GROUP_ID = "__ungrouped__";
const LATEST_ARTICLE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_DIRECTORY_WIDTH = 460;
const DIRECTORY_HIDE_THRESHOLD = 180;
const DIRECTORY_RESTORE_WIDTH = 320;
const DIRECTORY_MAX_WIDTH = 720;
const READER_MIN_WIDTH = 340;
const ARTICLE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatArticleDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() === 0) return "";
  return ARTICLE_DATE_FORMATTER.format(date);
}

function isLatestArticle(article: FeedArticle) {
  const publishedAt = Date.parse(article.publishedAt);
  return Number.isFinite(publishedAt) && publishedAt >= Date.now() - LATEST_ARTICLE_WINDOW_MS;
}

function feedErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("历史文章第")) return message;
  return /fetch failed|network|enotfound|err_/i.test(message)
    ? "无法连接订阅地址，请检查网络连接，或直接输入 RSS / Atom 链接"
    : message;
}

export function FocusReader({
  feeds,
  groups,
  articles,
  feedsBusy,
  subscribing,
  onSubscribe,
  onRefresh,
  onRemoveFeed,
  onUpdateArticle,
  onOpenArticle,
  onAddGroup,
  onRenameGroup,
  onRemoveGroup,
  onSetFeedGroup,
}: FocusReaderProps) {
  const [activeFilter, setActiveFilter] = useState<FocusFilter>("all");
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [expandedFeedIds, setExpandedFeedIds] = useState<Set<string>>(new Set());
  const [expandedFilterIds, setExpandedFilterIds] = useState<Set<FocusFilter>>(new Set());
  const [query, setQuery] = useState("");
  const [subscribeGroupId, setSubscribeGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [groupEditorMode, setGroupEditorMode] = useState<"create" | "rename" | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "root" | "group" | "feed"; id?: string } | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticleContext, setSelectedArticleContext] = useState<{ type: "feed" | "filter"; id: string } | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("");
  const [actionError, setActionError] = useState("");
  const [browserError, setBrowserError] = useState("");
  const [directoryCollapsed, setDirectoryCollapsed] = useState(false);
  const [directoryWidth, setDirectoryWidth] = useState(DEFAULT_DIRECTORY_WIDTH);
  const [directoryResizing, setDirectoryResizing] = useState(false);
  const readerLayoutRef = useRef<HTMLDivElement>(null);
  const directoryResizePointerRef = useRef<number | null>(null);
  const lastComfortableDirectoryWidthRef = useRef(DEFAULT_DIRECTORY_WIDTH);
  const browserHostRef = useRef<HTMLDivElement>(null);
  const browserRequestRef = useRef(0);
  const closeBrowserTimerRef = useRef<number | null>(null);
  const selectedArticle = articles.find((article) => article.id === selectedArticleId) ?? null;

  useEffect(() => {
    return window.desktop.onBrowserNavigate(setBrowserUrl);
  }, []);

  useEffect(() => () => {
    browserRequestRef.current += 1;
    window.desktop.setBrowserResizing(false);
  }, []);

  useEffect(() => {
    const layout = readerLayoutRef.current;
    if (!layout) return undefined;

    const keepDirectoryWithinBounds = () => {
      const maximumWidth = Math.max(
        DIRECTORY_HIDE_THRESHOLD + 1,
        Math.min(DIRECTORY_MAX_WIDTH, layout.getBoundingClientRect().width - READER_MIN_WIDTH),
      );
      setDirectoryWidth((currentWidth) => Math.min(currentWidth, maximumWidth));
    };

    const observer = new ResizeObserver(keepDirectoryWithinBounds);
    observer.observe(layout);
    keepDirectoryWithinBounds();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("pointerdown", closeContextMenu);
    return () => window.removeEventListener("pointerdown", closeContextMenu);
  }, []);

  useEffect(() => {
    if (browserOpen && closeBrowserTimerRef.current !== null) {
      window.clearTimeout(closeBrowserTimerRef.current);
      closeBrowserTimerRef.current = null;
    }

    if (!browserOpen) return undefined;
    const host = browserHostRef.current;
    if (!host) return undefined;

    const updateBounds = () => {
      const rect = host.getBoundingClientRect();
      window.desktop.setBrowserBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };
    const observer = new ResizeObserver(updateBounds);
    observer.observe(host);
    window.addEventListener("resize", updateBounds);
    const scrollContainer = document.querySelector(".main-content");
    scrollContainer?.addEventListener("scroll", updateBounds, { passive: true });
    updateBounds();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
      scrollContainer?.removeEventListener("scroll", updateBounds);
      // React StrictMode briefly cleans up and re-runs effects in development.
      // Delay destruction so that the second setup can cancel this cleanup.
      closeBrowserTimerRef.current = window.setTimeout(() => {
        closeBrowserTimerRef.current = null;
        window.desktop.closeBrowser();
      }, 0);
    };
  }, [browserOpen]);

  async function submitSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = feedUrl.trim();
    if (!value) return;
    setActionError("");
    try {
      const id = await onSubscribe(value);
      setFeedUrl("");
      if (subscribeGroupId) onSetFeedGroup(id, subscribeGroupId);
      setActiveFeedId(id);
      setActiveGroupId(subscribeGroupId || null);
      setActiveFilter("all");
    } catch (error) {
      setActionError(feedErrorMessage(error, "订阅失败"));
    }
  }

  async function refresh(feedId?: string) {
    setActionError("");
    try {
      await onRefresh(feedId);
    } catch (error) {
      setActionError(feedErrorMessage(error, "刷新失败"));
    }
  }

  async function loadBrowserUrl(url: string) {
    const requestId = ++browserRequestRef.current;
    setBrowserUrl(url);
    setBrowserError("");
    setBrowserOpen(true);
    setBrowserLoading(true);
    try {
      await window.desktop.openBrowser(url);
      if (requestId === browserRequestRef.current) setBrowserLoading(false);
      return true;
    } catch (error) {
      if (requestId !== browserRequestRef.current) return false;
      setBrowserOpen(false);
      setBrowserLoading(false);
      setBrowserError(error instanceof Error ? error.message : "网页打开失败");
      return false;
    }
  }

  async function navigateBrowser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = browserUrl.trim();
    if (!value) return;
    try {
      const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
      const url = new URL(candidate);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
      await loadBrowserUrl(url.toString());
    } catch {
      setBrowserError("请输入有效的网页地址");
    }
  }

  async function openArticle(article: FeedArticle, context?: { type: "feed" | "filter"; id: string }) {
    setSelectedArticleId(article.id);
    if (context) setSelectedArticleContext(context);
    if (await loadBrowserUrl(article.link)) onOpenArticle(article.id);
  }

  function closeBrowser() {
    browserRequestRef.current += 1;
    setBrowserOpen(false);
    setBrowserLoading(false);
    setBrowserUrl("");
    setBrowserError("");
    setSelectedArticleId(null);
    setSelectedArticleContext(null);
  }

  function removeFeed(feedId: string) {
    onRemoveFeed(feedId);
    if (activeFeedId === feedId) setActiveFeedId(null);
  }

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    setActiveGroupId(groupId);
    setActiveFeedId(null);
    setActiveFilter("all");
  }

  function selectFeed(feedId: string, groupId: string) {
    setExpandedFeedIds((current) => {
      const next = new Set(current);
      if (next.has(feedId)) next.delete(feedId);
      else next.add(feedId);
      return next;
    });
    setActiveFeedId(feedId);
    setActiveGroupId(groupId);
    setActiveFilter("all");
  }

  function selectFilter(filter: FocusFilter) {
    setActiveFeedId(null);
    setActiveGroupId(null);
    setActiveFilter(filter);
  }

  function toggleFilter(filter: FocusFilter) {
    setExpandedFilterIds((current) => {
      const next = new Set(current);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
    selectFilter(filter);
  }

  function openContextMenu(event: MouseEvent, type: "root" | "group" | "feed", id?: string) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, type, id });
  }

  function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    if (groups.some((group) => group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setActionError("已经有同名分组了");
      return;
    }
    const id = onAddGroup(name);
    if (id) setExpandedGroupIds((current) => new Set(current).add(id));
    setGroupName("");
    setGroupEditorMode(null);
    setActionError("");
  }

  function startRenameGroup(group: FeedGroup) {
    setContextMenu(null);
    setGroupEditorMode("rename");
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  function saveRenameGroup(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const name = editingGroupName.trim();
    if (!name) return;
    if (groups.some((group) => group.id !== groupId && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setActionError("已经有同名分组了");
      return;
    }
    onRenameGroup(groupId, name);
    setEditingGroupId(null);
    setEditingGroupName("");
    setGroupEditorMode(null);
    setActionError("");
  }

  function removeGroup(groupId: string) {
    onRemoveGroup(groupId);
    if (activeGroupId === groupId) setActiveGroupId(null);
    if (editingGroupId === groupId) setEditingGroupId(null);
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      next.delete(groupId);
      return next;
    });
  }

  function startCreateGroup() {
    setContextMenu(null);
    setGroupEditorMode("create");
    setGroupName("");
    setEditingGroupId(null);
    setEditingGroupName("");
    setActionError("");
  }

  function cancelGroupEditor() {
    setGroupEditorMode(null);
    setGroupName("");
    setEditingGroupId(null);
    setEditingGroupName("");
  }

  function maximumDirectoryWidth() {
    const layoutWidth = readerLayoutRef.current?.getBoundingClientRect().width ?? DIRECTORY_MAX_WIDTH + READER_MIN_WIDTH;
    return Math.max(
      DIRECTORY_HIDE_THRESHOLD + 1,
      Math.min(DIRECTORY_MAX_WIDTH, layoutWidth - READER_MIN_WIDTH),
    );
  }

  function updateDirectoryWidth(requestedWidth: number) {
    const nextWidth = Math.min(maximumDirectoryWidth(), Math.max(DIRECTORY_HIDE_THRESHOLD + 1, requestedWidth));
    setDirectoryWidth(nextWidth);
    if (nextWidth >= DIRECTORY_RESTORE_WIDTH) lastComfortableDirectoryWidthRef.current = nextWidth;
  }

  function hideDirectory() {
    setDirectoryCollapsed(true);
    setContextMenu(null);
    setGroupEditorMode(null);
  }

  function toggleDirectory() {
    if (directoryCollapsed) {
      updateDirectoryWidth(Math.max(DIRECTORY_RESTORE_WIDTH, lastComfortableDirectoryWidthRef.current));
      setDirectoryCollapsed(false);
      return;
    }
    hideDirectory();
  }

  function resizeDirectory(clientX: number) {
    const layout = readerLayoutRef.current;
    if (!layout) return;
    const requestedWidth = clientX - layout.getBoundingClientRect().left;
    if (requestedWidth <= DIRECTORY_HIDE_THRESHOLD) {
      hideDirectory();
      return;
    }
    updateDirectoryWidth(requestedWidth);
    setDirectoryCollapsed(false);
  }

  function startDirectoryResize(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    directoryResizePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDirectoryResizing(true);
    window.desktop.setBrowserResizing(true);
    resizeDirectory(event.clientX);
  }

  function continueDirectoryResize(event: PointerEvent<HTMLDivElement>) {
    if (directoryResizePointerRef.current !== event.pointerId) return;
    resizeDirectory(event.clientX);
  }

  function finishDirectoryResize(event: PointerEvent<HTMLDivElement>) {
    if (directoryResizePointerRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    directoryResizePointerRef.current = null;
    setDirectoryResizing(false);
    window.desktop.setBrowserResizing(false);
  }

  function loseDirectoryResize(event: PointerEvent<HTMLDivElement>) {
    if (directoryResizePointerRef.current !== event.pointerId) return;
    directoryResizePointerRef.current = null;
    setDirectoryResizing(false);
    window.desktop.setBrowserResizing(false);
  }

  function resizeDirectoryWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      hideDirectory();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const requestedWidth = directoryWidth + (event.key === "ArrowLeft" ? -24 : 24);
    if (requestedWidth <= DIRECTORY_HIDE_THRESHOLD) {
      hideDirectory();
      return;
    }
    updateDirectoryWidth(requestedWidth);
  }

  function articlesForFilter(filter: FocusFilter, feedId?: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return articles
      .filter((article) => !feedId || article.feedId === feedId)
      .filter((article) => filter === "all" || (filter === "latest" ? isLatestArticle(article) : article.saved))
      .filter((article) => {
        if (!normalizedQuery) return true;
        const feedTitle = feeds.find((feed) => feed.id === article.feedId)?.title ?? "";
        return `${article.title} ${article.excerpt} ${article.author} ${feedTitle}`.toLocaleLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }

  function feedArticlesForDisplay(feedId: string) {
    return articlesForFilter("all", feedId);
  }

  function renderArticleRow(article: FeedArticle, context: { type: "feed" | "filter"; id: string }, showFeed = false) {
    const selected = selectedArticleId === article.id
      && selectedArticleContext?.type === context.type
      && selectedArticleContext.id === context.id;
    const sourceName = feeds.find((feed) => feed.id === article.feedId)?.title;
    const publishedDate = formatArticleDate(article.publishedAt);
    return (
      <article className={`feed-article-row${article.read ? " read" : " unread"}${selected ? " selected" : ""}`} key={article.id} onContextMenu={(event) => event.stopPropagation()}>
        <button className="feed-article-select" type="button" onClick={() => void openArticle(article, context)}>
          {showFeed && sourceName && <span className="feed-article-meta"><span className="feed-article-source" title={sourceName}>{sourceName}</span></span>}
          <strong className="feed-article-title">{article.title}</strong>
          {article.excerpt && <span className="feed-article-excerpt">{article.excerpt}</span>}
          {(article.author || publishedDate) && <span className="feed-article-footer">
            {article.author && <span className="feed-article-author">{article.author}</span>}
            {publishedDate && <time dateTime={article.publishedAt}>{publishedDate}</time>}
          </span>}
        </button>
        <button className={article.saved ? "article-save saved" : "article-save"} type="button" onClick={() => onUpdateArticle(article.id, { saved: !article.saved })} aria-label={article.saved ? "取消收藏" : "收藏文章"} title={article.saved ? "取消收藏" : "收藏文章"}>
          <Bookmark size={14} fill={article.saved ? "currentColor" : "none"} />
        </button>
      </article>
    );
  }

  function renderFeedRow(feed: FeedSource, groupId: string, child = false) {
    const articleCount = articles.filter((article) => article.feedId === feed.id).length;
    const feedArticles = feedArticlesForDisplay(feed.id);
    const expanded = expandedFeedIds.has(feed.id);
    return (
      <div className={`feed-source-tree-item${child ? " child" : ""}`} key={feed.id} onContextMenu={(event) => openContextMenu(event, "feed", feed.id)}>
        <div className={`feed-source-row${activeFeedId === feed.id ? " active" : ""}${feed.lastError ? " error" : ""}`}>
          <button type="button" className="feed-source-select" onClick={() => selectFeed(feed.id, groupId)} title={feed.lastError || feed.title}>
            {expanded ? <ChevronDown size={13} className="feed-source-chevron" /> : <ChevronRight size={13} className="feed-source-chevron" />}
            <span className="feed-source-mark">{feed.title.slice(0, 1).toLocaleUpperCase()}</span>
            <span className="feed-source-name">{feed.title}</span>
            <small title={`${articleCount} 篇文章`}>{articleCount}</small>
          </button>
          <button className="feed-source-remove" type="button" onClick={() => removeFeed(feed.id)} aria-label={`取消订阅 ${feed.title}`} title="取消订阅"><Trash2 size={13} /></button>
        </div>
        {expanded && <div className="feed-article-children">
          {feedArticles.map((article) => renderArticleRow(article, { type: "feed", id: feed.id }))}
          {feedArticles.length === 0 && <p className="feed-empty">没有符合条件的文章</p>}
        </div>}
      </div>
    );
  }

  return (
    <section className={`focus-reader${directoryCollapsed ? " directory-is-collapsed" : ""}`}>
      <div
        ref={readerLayoutRef}
        className={`reader-layout${directoryCollapsed ? " directory-is-collapsed" : ""}${directoryResizing ? " is-resizing" : ""}`}
        style={{ "--directory-width": `${directoryWidth}px` } as CSSProperties}
      >
        <section className={`article-column${directoryCollapsed ? " directory-collapsed" : ""}`} aria-label="订阅目录和文章列表">
          <form className="subscribe-form" onSubmit={submitSubscription}>
            <Rss size={17} />
            <input autoFocus value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="输入网站地址或 RSS / Atom 链接" aria-label="网站或订阅链接" />
            <select className="subscribe-group-select" value={subscribeGroupId} onChange={(event) => setSubscribeGroupId(event.target.value)} aria-label="添加到分组">
              <option value="">不分组</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <button type="submit" disabled={subscribing || !feedUrl.trim()}>{subscribing ? <LoaderCircle className="spinning" size={15} /> : <Plus size={15} />}订阅</button>
          </form>
          {actionError && <div className="reader-error" role="alert">{actionError}</div>}
          <div className="article-directory" onContextMenu={(event) => openContextMenu(event, "root")}>
          <div className="feed-tree-heading">
            <span>订阅目录</span>
            <span className="feed-tree-count">{feeds.length} 个订阅源</span>
          </div>
          <div className="feed-tree" aria-label="订阅目录">
            <button className={!activeFeedId && !activeGroupId && activeFilter === "latest" ? "feed-tree-filter-row active" : "feed-tree-filter-row"} type="button" onClick={() => toggleFilter("latest")} aria-expanded={expandedFilterIds.has("latest")}>
              {expandedFilterIds.has("latest") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Clock3 size={15} />
              <span>最新</span>
              <small>{articles.filter(isLatestArticle).length}</small>
            </button>
            {expandedFilterIds.has("latest") && <div className="feed-filter-articles">{articlesForFilter("latest").map((article) => renderArticleRow(article, { type: "filter", id: "latest" }, true))}</div>}
            <div className="feed-tree-root">
              <button className={!activeFeedId && !activeGroupId && activeFilter === "all" ? "feed-tree-filter-row active" : "feed-tree-filter-row"} type="button" onClick={() => selectFilter("all")}>
                <ChevronDown size={14} />
                <Rss size={15} />
                <span>全部文章</span>
                <small>{articles.length}</small>
              </button>
              <div className="feed-tree-children root-children">
                {groups.map((group) => {
                  const groupFeeds = feeds.filter((feed) => feed.groupId === group.id);
                  const groupFeedIds = new Set(groupFeeds.map((feed) => feed.id));
                  const articleCount = articles.filter((article) => groupFeedIds.has(article.feedId)).length;
                  const expanded = expandedGroupIds.has(group.id);
                  return (
                    <div className="feed-tree-group" key={group.id}>
                      <button className={activeGroupId === group.id && !activeFeedId ? "feed-group-tree-row active" : "feed-group-tree-row"} type="button" onClick={() => toggleGroup(group.id)} onContextMenu={(event) => openContextMenu(event, "group", group.id)} aria-expanded={expanded}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={15} />
                        <span>{group.name}</span>
                        <small>{articleCount}</small>
                      </button>
                      {expanded && <div className="feed-tree-children">
                        {groupFeeds.map((feed) => renderFeedRow(feed, group.id, true))}
                        {groupFeeds.length === 0 && <p className="feed-empty">分组里还没有订阅源</p>}
                      </div>}
                    </div>
                  );
                })}
                {feeds.some((feed) => !feed.groupId) && (() => {
                  const ungroupedFeeds = feeds.filter((feed) => !feed.groupId);
                  const articleCount = articles.filter((article) => ungroupedFeeds.some((feed) => feed.id === article.feedId)).length;
                  const expanded = expandedGroupIds.has(UNGROUPED_GROUP_ID);
                  return (
                    <div className="feed-tree-group" key={UNGROUPED_GROUP_ID}>
                      <button className={activeGroupId === UNGROUPED_GROUP_ID && !activeFeedId ? "feed-group-tree-row active" : "feed-group-tree-row"} type="button" onClick={() => toggleGroup(UNGROUPED_GROUP_ID)} aria-expanded={expanded}>
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Folder size={15} />
                        <span>未分组</span>
                        <small>{articleCount}</small>
                      </button>
                      {expanded && <div className="feed-tree-children">{ungroupedFeeds.map((feed) => renderFeedRow(feed, UNGROUPED_GROUP_ID, true))}</div>}
                    </div>
                  );
                })()}
                {feeds.length === 0 && <p className="feed-empty">还没有订阅源</p>}
              </div>
            </div>
            <button className={!activeFeedId && !activeGroupId && activeFilter === "saved" ? "feed-tree-filter-row active" : "feed-tree-filter-row"} type="button" onClick={() => toggleFilter("saved")} aria-expanded={expandedFilterIds.has("saved")}>
              {expandedFilterIds.has("saved") ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Bookmark size={15} />
              <span>已收藏</span>
              <small>{articles.filter((article) => article.saved).length}</small>
            </button>
            {expandedFilterIds.has("saved") && <div className="feed-filter-articles">{articlesForFilter("saved").map((article) => renderArticleRow(article, { type: "filter", id: "saved" }, true))}</div>}
          </div>
          <div className="directory-toolbar">
            <div className="reader-toolbar">
              <label className="reader-search">
                <Search size={16} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文章" aria-label="搜索文章" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜索"><X size={14} /></button>}
              </label>
              <button className="reader-icon-button" type="button" onClick={() => void refresh()} disabled={feedsBusy || feeds.length === 0} aria-label="刷新所有订阅" title="刷新所有订阅">
                {feedsBusy ? <LoaderCircle className="spinning" size={16} /> : <RefreshCw size={16} />}
              </button>
            </div>
          </div>
          </div>
          {groupEditorMode && (
            <form className="inline-group-editor" onSubmit={editingGroupId ? (event) => saveRenameGroup(event, editingGroupId) : createGroup}>
              <input autoFocus value={editingGroupId ? editingGroupName : groupName} onChange={(event) => editingGroupId ? setEditingGroupName(event.target.value) : setGroupName(event.target.value)} placeholder="分组名称" aria-label="分组名称" />
              <button className="feed-group-action" type="submit" aria-label="保存分组" title="保存"><Check size={13} /></button>
              <button className="feed-group-action" type="button" onClick={cancelGroupEditor} aria-label="取消" title="取消"><X size={13} /></button>
            </form>
          )}
          {contextMenu && (
            <div className="feed-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
              {contextMenu.type === "group" && contextMenu.id && <>
                <button type="button" onClick={() => { const group = groups.find((item) => item.id === contextMenu.id); if (group) startRenameGroup(group); }}>重命名分组</button>
                <button type="button" className="danger" onClick={() => { removeGroup(contextMenu.id!); setContextMenu(null); }}>删除分组</button>
              </>}
              {contextMenu.type === "feed" && contextMenu.id && <button type="button" className="danger" onClick={() => { removeFeed(contextMenu.id!); setContextMenu(null); }}>取消订阅</button>}
              {contextMenu.type === "root" && <button type="button" onClick={startCreateGroup}>新建分组</button>}
            </div>
          )}
        </section>
        <div
          className="reader-resizer"
          role="separator"
          aria-label="调整订阅目录宽度"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={DIRECTORY_MAX_WIDTH}
          aria-valuenow={directoryCollapsed ? 0 : Math.round(directoryWidth)}
          tabIndex={directoryCollapsed ? -1 : 0}
          onKeyDown={resizeDirectoryWithKeyboard}
          onPointerDown={startDirectoryResize}
          onPointerMove={continueDirectoryResize}
          onPointerUp={finishDirectoryResize}
          onPointerCancel={finishDirectoryResize}
          onLostPointerCapture={loseDirectoryResize}
        />

        <section className={`reader-pane${browserOpen ? " browser-active" : ""}`} aria-label="文章阅读区">
          <div className="browser-toolbar">
            <div className="browser-controls">
              <button
                type="button"
                className="reader-icon-button directory-visibility-button"
                onClick={toggleDirectory}
                aria-expanded={!directoryCollapsed}
                aria-label={directoryCollapsed ? "显示订阅目录" : "隐藏订阅目录"}
                title={directoryCollapsed ? "显示订阅目录" : "隐藏订阅目录"}
              >
                <span className={`directory-panel-icon${directoryCollapsed ? " directory-hidden" : ""}`} aria-hidden="true" />
              </button>
              {selectedArticle && <>
                <button type="button" className="reader-icon-button" disabled={!browserOpen} onClick={() => window.desktop.browserBack()} aria-label="后退" title="后退"><ArrowLeft size={15} /></button>
                <button type="button" className="reader-icon-button" disabled={!browserOpen} onClick={() => window.desktop.browserForward()} aria-label="前进" title="前进"><ArrowRight size={15} /></button>
                <button type="button" className="reader-icon-button" disabled={!browserOpen} onClick={() => window.desktop.browserReload()} aria-label="刷新页面" title="刷新页面"><RefreshCw size={14} /></button>
                <button type="button" className="reader-icon-button" onClick={closeBrowser} aria-label="返回阅读首页" title="返回阅读首页"><ArrowDownLeft size={15} /></button>
              </>}
            </div>
            {selectedArticle && <form className="browser-address" onSubmit={(event) => void navigateBrowser(event)} title={browserUrl}>
              <Globe2 size={13} />
              <input value={browserUrl} onChange={(event) => setBrowserUrl(event.target.value)} onFocus={(event) => event.currentTarget.select()} aria-label="网页地址" autoComplete="off" spellCheck={false} />
            </form>}
          </div>
          {selectedArticle ? (
            <div className="browser-host" ref={browserHostRef}>
              {(!browserOpen || browserLoading) && (
                <div className="browser-placeholder">
                  {browserError ? <><strong>页面暂时无法打开</strong><span>{browserError}</span><button type="button" onClick={() => void loadBrowserUrl(browserUrl || selectedArticle.link)}><RefreshCw size={14} />重试</button></> : <><LoaderCircle className="spinning" size={20} /><span>正在打开文章…</span></>}
                </div>
              )}
            </div>
          ) : (
            <div className="reader-welcome">
              <div className="reader-welcome-mark"><Rss size={19} /></div>
              <h2>你的阅读流</h2>
              <p>选择一篇文章，在 DeskFlow 内继续阅读。</p>
              {feeds.length > 0 && <div className="reader-welcome-meta"><Check size={14} />{feeds.length} 个订阅源 <span />{articles.filter((article) => !article.read).length} 篇未读</div>}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
