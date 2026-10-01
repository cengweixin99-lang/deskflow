import type { FeedArticle, FeedSource, FetchedText } from "../types";

export interface DiscoveredFeed {
  title: string;
  url: string;
  siteUrl: string;
  description: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  description: string;
  generator: string;
  articles: Omit<FeedArticle, "read" | "saved">[];
}

export const MAX_FEED_ARTICLES = 300;
const MAX_FEED_PAGES = 30;

function normalizeWebUrl(value: string, base?: string): string {
  const input = value.trim();
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  const url = new URL(withProtocol, base);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("请使用 http 或 https 网站地址");
  }
  if (url.username || url.password) throw new Error("地址中不能包含登录凭据");
  url.hash = "";
  return url.toString();
}

function localName(element: Element): string {
  return element.localName.toLowerCase();
}

function descendants(parent: ParentNode, names: string[]): Element[] {
  return Array.from(parent.querySelectorAll("*" )).filter((element) =>
    names.includes(localName(element)),
  );
}

function firstText(parent: ParentNode, names: string[]): string {
  const element = descendants(parent, names)[0];
  return element?.textContent?.trim() ?? "";
}

function htmlToText(value: string): string {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parseXml(text: string): XMLDocument {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("订阅源内容不是有效的 RSS 或 Atom XML");
  return document;
}

function feedRoot(text: string): { document: XMLDocument; root: Element } | null {
  const document = parseXml(text);
  const root = document.documentElement;
  return ["rss", "feed", "rdf"].includes(localName(root))
    ? { document, root }
    : null;
}

function resolveLink(value: string, base: string): string {
  if (!value.trim()) return "";
  try {
    return normalizeWebUrl(value, base);
  } catch {
    return "";
  }
}

export function parseFeed(source: FeedSource, response: FetchedText): ParsedFeed {
  const parsed = feedRoot(response.text);
  if (!parsed) throw new Error("这个地址没有返回 RSS 或 Atom 订阅内容");

  const { document, root } = parsed;
  const channel = localName(root) === "rss"
    ? descendants(root, ["channel"])[0] ?? root
    : root;
  const feedTitle = firstText(channel, ["title"]) || source.title;
  const siteUrl = resolveLink(firstText(channel, ["link"]), response.url) || source.siteUrl;
  const description = htmlToText(firstText(channel, ["description", "subtitle"])) || source.description;
  const entries = descendants(document, ["item", "entry"]);

  const articles = entries.flatMap((entry) => {
    const linkElement = descendants(entry, ["link"]).find((element) => {
      const rel = element.getAttribute("rel");
      return !rel || rel === "alternate";
    });
    const rawLink = linkElement?.getAttribute("href") || linkElement?.textContent || "";
    const link = resolveLink(rawLink, response.url);
    if (!link) return [];

    const title = firstText(entry, ["title"]) || "未命名文章";
    const excerptHtml = firstText(entry, ["encoded", "content", "description", "summary"]);
    const excerpt = htmlToText(excerptHtml).slice(0, 360);
    const author = firstText(entry, ["creator", "author"]);
    const published = firstText(entry, ["published", "pubdate", "updated", "date"]);
    const timestamp = Date.parse(published);

    return [{
      id: `${source.id}:${link}`,
      feedId: source.id,
      title,
      link,
      excerpt,
      author,
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString(),
    }];
  });

  return { title: feedTitle, siteUrl, description, generator: firstText(channel, ["generator"]), articles };
}

export async function fetchParsedFeed(source: FeedSource): Promise<ParsedFeed> {
  const firstResponse = await window.desktop.fetchText(source.url);
  const firstPage = parseFeed(source, firstResponse);
  const isWordPressFeed = /^(?:https?:\/\/(?:www\.)?wordpress\.org(?:[/?#]|$)|wordpress(?:\s|$))/i.test(firstPage.generator);
  if (!isWordPressFeed) return firstPage;

  const articles = new Map(firstPage.articles.map((article) => [article.id, article]));
  if (!articles.size) return firstPage;
  const feedUrl = new URL(source.url);
  const requestedPage = Number(feedUrl.searchParams.get("paged") ?? 1);
  const firstPageNumber = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  for (let offset = 1; offset < MAX_FEED_PAGES && articles.size < MAX_FEED_ARTICLES; offset += 1) {
    const page = firstPageNumber + offset;
    const pageUrl = new URL(feedUrl);
    pageUrl.searchParams.set("paged", String(page));
    let response: FetchedText;
    try {
      response = await window.desktop.fetchText(pageUrl.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Only a missing page is the normal end of a WordPress archive.
      if (/\bHTTP\s+404\b/i.test(message)) break;
      throw new Error(`历史文章第 ${page} 页加载失败，请重试（${message}）`);
    }
    const parsed = parseFeed(source, response);
    const previousCount = articles.size;
    for (const article of parsed.articles) articles.set(article.id, article);
    // Some feeds ignore paged and keep returning the first page.
    if (articles.size === previousCount) break;
  }

  return { ...firstPage, articles: [...articles.values()].slice(0, MAX_FEED_ARTICLES) };
}

function readHtmlFeedLinks(html: string, baseUrl: string): DiscoveredFeed[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const title = document.querySelector("title")?.textContent?.trim() || "新订阅";
  const candidates = Array.from(document.querySelectorAll('link[rel~="alternate"]'))
    .filter((element) => /rss|atom|xml/i.test(element.getAttribute("type") ?? ""))
    .map((element) => {
      const url = resolveLink(element.getAttribute("href") ?? "", baseUrl);
      return url ? {
        title: element.getAttribute("title")?.trim() || title,
        url,
        siteUrl: baseUrl,
        description: "",
      } : null;
    })
    .filter((candidate): candidate is DiscoveredFeed => candidate !== null);
  return candidates;
}

export async function discoverFeed(input: string): Promise<DiscoveredFeed> {
  const targetUrl = normalizeWebUrl(input);
  let page: FetchedText | null = null;
  try {
    page = await window.desktop.fetchText(targetUrl);
  } catch {
    // Some SSR/WordPress hosts block HTML requests but still expose a feed.
  }

  const target = new URL(targetUrl);
  const directCandidates = [
    targetUrl,
    `${target.origin}${target.pathname.replace(/\/$/, "")}/feed/`,
    `${target.origin}${target.pathname}${target.search ? `${target.search}&` : "?"}feed=rss2`,
    `${target.origin}${target.pathname}${target.search ? `${target.search}&` : "?"}feed=atom`,
    `${target.origin}${target.pathname}${target.search ? `${target.search}&` : "?"}feed=rss`,
  ];

  for (const candidateUrl of [...new Set(directCandidates)]) {
    try {
      const response = await window.desktop.fetchText(candidateUrl);
      const parsed = feedRoot(response.text);
      if (!parsed) continue;
      const title = firstText(parsed.root, ["title"]) || target.hostname;
      const siteUrl = resolveLink(firstText(parsed.root, ["link"]), response.url) || targetUrl;
      return { title, url: response.url, siteUrl, description: htmlToText(firstText(parsed.root, ["description", "subtitle"])) };
    } catch {
      // Try the next feed candidate.
    }
  }

  if (!page) throw new Error("无法读取网站内容，请检查网络连接，或直接输入可访问的 RSS / Atom 链接");

  const direct = (() => {
    try {
      return feedRoot(page.text);
    } catch {
      return null;
    }
  })();

  if (direct) {
    const title = firstText(direct.root, ["title"]) || new URL(page.url).hostname;
    const siteUrl = resolveLink(firstText(direct.root, ["link"]), page.url) || page.url;
    return { title, url: page.url, siteUrl, description: htmlToText(firstText(direct.root, ["description", "subtitle"])) };
  }

  const links = readHtmlFeedLinks(page.text, page.url);
  if (links.length) return links[0];

  const origin = new URL(page.url).origin;
  for (const path of ["/feed", "/feed.xml", "/rss.xml", "/atom.xml", "/?feed=rss2"]) {
    const candidateUrl = `${origin}${path}`;
    try {
      const response = await window.desktop.fetchText(candidateUrl);
      const parsed = feedRoot(response.text);
      if (!parsed) continue;
      return {
        title: firstText(parsed.root, ["title"]) || new URL(page.url).hostname,
        url: response.url,
        siteUrl: page.url,
        description: htmlToText(firstText(parsed.root, ["description", "subtitle"])),
      };
    } catch {
      // Try the next conventional feed URL.
    }
  }

  throw new Error("没有找到这个网站的 RSS/Atom 订阅地址，请直接输入 RSS 链接");
}
