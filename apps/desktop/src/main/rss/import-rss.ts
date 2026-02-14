import path from "path";
import Parser from "rss-parser";
import { fileSystem } from "../file-system";

interface RssImportResult {
  folderName: string;
  folderPath: string;
  itemCount: number;
}

interface RssMetadataItem {
  guid?: string;
  link?: string;
  published?: string;
  title?: string;
}

interface RssMetadata {
  type: "rss";
  url: string;
  title: string;
  lastFetched: string;
  items: RssMetadataItem[];
}

type RssItem = Parser.Item & {
  "content:encoded"?: string;
  description?: string;
  enclosure?: { url?: string; type?: string };
  image?: { url?: string };
  [key: string]: unknown;
};

import { sanitizeName, formatDate, buildFrontmatter } from "../utils/content-import";

async function getAvailableFolderName(workspacePath: string, baseName: string): Promise<string> {
  const normalizedBase = sanitizeName(baseName) || "RSS";
  let candidate = normalizedBase;
  let counter = 2;

  while (await fileSystem.exists(path.join(workspacePath, candidate))) {
    candidate = `${normalizedBase}-${counter}`;
    counter += 1;
  }

  return candidate;
}

async function getAvailableFileName(folderPath: string, baseName: string): Promise<string> {
  const normalizedBase = sanitizeName(baseName) || "untitled";
  let candidate = `${normalizedBase}.md`;
  let counter = 2;

  while (await fileSystem.exists(path.join(folderPath, candidate))) {
    candidate = `${normalizedBase}-${counter}.md`;
    counter += 1;
  }

  return candidate;
}

function buildItemKey(item: { guid?: string; link?: string }): string | null {
  if (item.guid) return `guid:${item.guid}`;
  if (item.link) return `link:${item.link}`;
  return null;
}

async function loadRssMetadata(folderPath: string): Promise<RssMetadata> {
  const metadataPath = path.join(folderPath, ".rss.json");
  const { content } = await fileSystem.readFile(metadataPath);
  return JSON.parse(content) as RssMetadata;
}

async function saveRssMetadata(folderPath: string, metadata: RssMetadata): Promise<void> {
  const metadataPath = path.join(folderPath, ".rss.json");
  await fileSystem.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

function pickItemContent(item: RssItem): string {
  const content =
    item["content:encoded"] || item.content || item.summary || item.contentSnippet || item.description || "";
  return typeof content === "string" ? content.trim() : "";
}

type MediaEntry = { url: string; type?: string };

function addMedia(entries: MediaEntry[], seen: Set<string>, url?: string, type?: string) {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed || seen.has(trimmed)) return;
  entries.push({ url: trimmed, type });
  seen.add(trimmed);
}

function addImageEntries(
  entries: MediaEntry[],
  seen: Set<string>,
  source:
    | { url?: string }
    | { href?: string }
    | { $?: { href?: string } }
    | string
    | Array<{ url?: string } | { href?: string } | { $?: { href?: string } } | string>
    | undefined
) {
  if (!source) return;
  const list = Array.isArray(source) ? source : [source];
  for (const entry of list) {
    if (!entry) continue;
    if (typeof entry === "string") {
      addMedia(entries, seen, entry, "image/");
      continue;
    }
    if ("url" in entry && typeof entry.url === "string") {
      addMedia(entries, seen, entry.url, "image/");
      continue;
    }
    if ("href" in entry && typeof entry.href === "string") {
      addMedia(entries, seen, entry.href, "image/");
      continue;
    }
    if ("$" in entry && typeof entry.$?.href === "string") {
      addMedia(entries, seen, entry.$.href, "image/");
    }
  }
}

function addMediaEntries(
  entries: MediaEntry[],
  seen: Set<string>,
  source: { url?: string; type?: string } | string | Array<{ url?: string; type?: string } | string> | undefined,
  fallbackType?: string
) {
  if (!source) return;
  const list = Array.isArray(source) ? source : [source];
  for (const entry of list) {
    if (!entry) continue;
    if (typeof entry === "string") {
      addMedia(entries, seen, entry, fallbackType);
      continue;
    }
    const url = typeof entry.url === "string" ? entry.url : undefined;
    const type = typeof entry.type === "string" ? entry.type : fallbackType;
    addMedia(entries, seen, url, type);
  }
}

function getMediaEntries(item: RssItem): MediaEntry[] {
  const entries: MediaEntry[] = [];
  const seen = new Set<string>();

  addMediaEntries(entries, seen, item.enclosure, undefined);
  addMediaEntries(entries, seen, item["media:content"] as { url?: string; type?: string } | undefined, undefined);
  addMediaEntries(entries, seen, item["media:thumbnail"] as { url?: string; type?: string } | undefined, "image/");
  addImageEntries(entries, seen, item["itunes:image"] as { href?: string } | undefined);
  addImageEntries(entries, seen, item.image as { url?: string } | undefined);

  return entries;
}

function buildMediaBlock(entries: MediaEntry[]): string {
  const blocks: string[] = [];
  for (const entry of entries) {
    if (entry.type?.startsWith("audio/")) {
      blocks.push(`<audio controls style="width: 100%;" src="${entry.url}"></audio>`);
      continue;
    }
    if (entry.type?.startsWith("video/")) {
      blocks.push(`<video controls style="width:100%; aspect-ratio:16/9;" src="${entry.url}"></video>`);
      continue;
    }
    if (entry.type?.startsWith("image/")) {
      blocks.push(`![media](${entry.url})`);
    }
  }
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n\n` : "";
}

function getFeedTitle(feed: Parser.Output<RssItem>, url: string): string {
  if (feed.title) return feed.title.trim();
  try {
    return new URL(url).hostname;
  } catch {
    return "RSS";
  }
}

export async function importRss(url: string, workspacePath: string): Promise<RssImportResult> {
  const parser: Parser<RssItem> = new Parser({
    customFields: {
      item: ["itunes:image", "media:thumbnail", "media:content", "image"]
    }
  });
  const feed = await parser.parseURL(url);
  const feedTitle = getFeedTitle(feed, url);

  const folderName = await getAvailableFolderName(workspacePath, feedTitle);
  const folderPath = path.join(workspacePath, folderName);
  await fileSystem.createFolder(folderPath);

  const metadataItems: RssMetadataItem[] = [];

  for (const item of feed.items || []) {
    const title = item.title?.trim() || "Untitled";
    const published = formatDate(item.isoDate || item.pubDate) || undefined;
    const datePrefix = published || "undated";
    const fileBaseName = `${datePrefix}-${title}`;
    const fileName = await getAvailableFileName(folderPath, fileBaseName);
    const filePath = path.join(folderPath, fileName);
    const link = item.link?.trim();
    const guid = item.guid?.trim() || item.id?.trim();

    const frontmatter = buildFrontmatter({
      hidden: true,
      title,
      link,
      guid,
      published,
      source: feedTitle
    });
    const mediaBlock = buildMediaBlock(getMediaEntries(item));
    const content = pickItemContent(item);
    const heading = `# ${title}\n\n`;
    const markdown = `${frontmatter}${heading}${mediaBlock}${content}`;

    await fileSystem.createFile(filePath, markdown);

    metadataItems.push({
      guid,
      link,
      published: published ? new Date(published).toISOString() : undefined,
      title
    });
  }

  const metadata: RssMetadata = {
    type: "rss",
    url,
    title: feedTitle,
    lastFetched: new Date().toISOString(),
    items: metadataItems
  };

  await fileSystem.createFile(path.join(folderPath, ".rss.json"), JSON.stringify(metadata, null, 2));

  return {
    folderName,
    folderPath,
    itemCount: metadataItems.length
  };
}

export async function updateRss(folderPath: string): Promise<{
  addedCount: number;
}> {
  const metadata = await loadRssMetadata(folderPath);
  const parser: Parser<RssItem> = new Parser({
    customFields: {
      item: ["itunes:image", "media:thumbnail", "media:content", "image"]
    }
  });
  const feed = await parser.parseURL(metadata.url);
  const feedTitle = getFeedTitle(feed, metadata.url);

  const existingKeys = new Set(
    metadata.items.map((item) => buildItemKey(item)).filter((key): key is string => Boolean(key))
  );

  const newItems: RssMetadataItem[] = [];
  let addedCount = 0;

  for (const item of feed.items || []) {
    const title = item.title?.trim() || "Untitled";
    const published = formatDate(item.isoDate || item.pubDate) || undefined;
    const link = item.link?.trim();
    const guid = item.guid?.trim() || item.id?.trim();
    const key = buildItemKey({ guid, link });

    if (key && existingKeys.has(key)) {
      continue;
    }

    const datePrefix = published || "undated";
    const fileBaseName = `${datePrefix}-${title}`;
    const fileName = await getAvailableFileName(folderPath, fileBaseName);
    const filePath = path.join(folderPath, fileName);

    const frontmatter = buildFrontmatter({
      hidden: true,
      title,
      link,
      guid,
      published,
      source: feedTitle
    });
    const mediaBlock = buildMediaBlock(getMediaEntries(item));
    const content = pickItemContent(item);
    const heading = `# ${title}\n\n`;
    const markdown = `${frontmatter}${heading}${mediaBlock}${content}`;

    await fileSystem.createFile(filePath, markdown);

    newItems.push({
      guid,
      link,
      published: published ? new Date(published).toISOString() : undefined,
      title
    });

    if (key) {
      existingKeys.add(key);
    }
    addedCount += 1;
  }

  metadata.title = feedTitle;
  metadata.lastFetched = new Date().toISOString();
  metadata.items = [...metadata.items, ...newItems];

  await saveRssMetadata(folderPath, metadata);

  return { addedCount };
}

export async function unsubscribeRss(folderPath: string): Promise<void> {
  const metadataPath = path.join(folderPath, ".rss.json");
  const exists = await fileSystem.exists(metadataPath);
  if (!exists) return;
  await fileSystem.deleteFile(metadataPath);
}
