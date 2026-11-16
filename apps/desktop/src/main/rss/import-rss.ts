import path from "path";
import fs from "fs/promises";
import { realpathSync } from "fs";
import Parser from "rss-parser";
import { fileSystem } from "../file-system";
import { assertSafeRemoteHttpUrl, fetchSafeRemoteHttp } from "../security/remote-url";

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

const MAX_RSS_BYTES = 10 * 1024 * 1024;

interface SubscriptionOperationState {
  generation: number;
  users: number;
  commitQueue: Promise<void>;
}

const subscriptionOperations = new Map<string, SubscriptionOperationState>();

function beginSubscriptionOperation(folderPath: string) {
  let key: string;
  try {
    key = realpathSync(folderPath);
  } catch {
    key = path.resolve(folderPath);
  }
  const state = subscriptionOperations.get(key) ?? { generation: 0, users: 0, commitQueue: Promise.resolve() };
  state.users += 1;
  subscriptionOperations.set(key, state);
  return {
    state,
    release: () => {
      if (--state.users === 0 && subscriptionOperations.get(key) === state) subscriptionOperations.delete(key);
    }
  };
}

function commitSubscriptionOperation<T>(state: SubscriptionOperationState, commit: () => Promise<T>): Promise<T> {
  const result = state.commitQueue.then(commit);
  state.commitQueue = result.then(
    () => {},
    () => {}
  );
  return result;
}

function assertSubscriptionGeneration(state: SubscriptionOperationState, generation: number): void {
  if (state.generation !== generation) throw new Error("RSS subscription changed while updating");
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > maxBytes) throw new Error("RSS feed is too large");
    return body;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("RSS feed is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

type RssItem = Parser.Item & {
  "content:encoded"?: string;
  description?: string;
  enclosure?: { url?: string; type?: string };
  image?: { url?: string };
  [key: string]: unknown;
};

import { sanitizeName, formatDate, buildCommentMetadata } from "../utils/content-import";

async function createAvailableFolder(workspacePath: string, baseName: string): Promise<string> {
  const normalizedBase = sanitizeName(baseName) || "RSS";
  let candidate = normalizedBase;
  let counter = 2;

  while (true) {
    try {
      // mkdir without recursive owns this directory exclusively, including across concurrent imports.
      await fs.mkdir(path.join(workspacePath, candidate));
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      candidate = `${normalizedBase}-${counter}`;
      counter += 1;
    }
  }
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

function buildItemKey(item: { guid?: string; link?: string; title?: string; published?: string }): string | null {
  if (item.guid) return `guid:${item.guid}`;
  if (item.link) return `link:${item.link}`;
  if (item.title || item.published) return `fallback:${item.title || ""}|${(item.published || "").slice(0, 10)}`;
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

async function parseFeed(parser: Parser<RssItem>, url: string): Promise<Parser.Output<RssItem>> {
  const { response } = await fetchSafeRemoteHttp(url, {
    headers: { "User-Agent": "zhiyuan-rss/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RSS_BYTES) throw new Error("RSS feed is too large");
  const body = await readLimitedBody(response, MAX_RSS_BYTES);
  return (await parser.parseString(new TextDecoder().decode(body))) as Parser.Output<RssItem>;
}

export async function importRss(url: string, workspacePath: string): Promise<RssImportResult> {
  await assertSafeRemoteHttpUrl(url);
  const parser: Parser<RssItem> = new Parser({
    customFields: {
      item: ["itunes:image", "media:thumbnail", "media:content", "image"]
    }
  });
  const feed = await parseFeed(parser, url);
  const feedTitle = getFeedTitle(feed, url);

  const folderName = await createAvailableFolder(workspacePath, feedTitle);
  const folderPath = path.join(workspacePath, folderName);

  const metadataItems: RssMetadataItem[] = [];
  try {
    for (const item of feed.items || []) {
      const title = item.title?.trim() || "Untitled";
      const publicationDate = item.isoDate || item.pubDate;
      const published = publicationDate ? formatDate(publicationDate) || undefined : undefined;
      const datePrefix = published || "undated";
      const fileBaseName = `${datePrefix}-${title}`;
      const fileName = await getAvailableFileName(folderPath, fileBaseName);
      const filePath = path.join(folderPath, fileName);
      const link = item.link?.trim();
      const guidValue = typeof item.guid === "string" ? item.guid : undefined;
      const idValue = typeof item.id === "string" ? item.id : undefined;
      const guid = guidValue?.trim() || idValue?.trim();

      const metadata = buildCommentMetadata({
        "rss-title": title,
        "rss-link": link,
        "rss-guid": guid,
        "rss-published": published,
        "rss-source": feedTitle
      });
      const mediaBlock = buildMediaBlock(getMediaEntries(item));
      const content = pickItemContent(item);
      const heading = `# ${title}\n\n`;
      const markdown = `${metadata}${heading}${mediaBlock}${content}`;

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
  } catch (error) {
    await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  return {
    folderName,
    folderPath,
    itemCount: metadataItems.length
  };
}

export async function updateRss(folderPath: string): Promise<{
  addedCount: number;
}> {
  const operation = beginSubscriptionOperation(folderPath);
  const generation = operation.state.generation;
  try {
    return await updateSubscription(folderPath, operation.state, generation);
  } finally {
    operation.release();
  }
}

async function updateSubscription(
  folderPath: string,
  state: SubscriptionOperationState,
  generation: number
): Promise<{ addedCount: number }> {
  const metadata = await loadRssMetadata(folderPath);
  await assertSafeRemoteHttpUrl(metadata.url);
  const parser: Parser<RssItem> = new Parser({
    customFields: {
      item: ["itunes:image", "media:thumbnail", "media:content", "image"]
    }
  });
  const feed = await parseFeed(parser, metadata.url);
  const feedTitle = getFeedTitle(feed, metadata.url);

  return commitSubscriptionOperation(state, async () => {
    assertSubscriptionGeneration(state, generation);
    // Another update may have committed while this request was fetching. Deduplicate against its latest metadata.
    const currentMetadata = await loadRssMetadata(folderPath);
    assertSubscriptionGeneration(state, generation);
    if (currentMetadata.url !== metadata.url) throw new Error("RSS subscription changed while updating");
    const existingKeys = new Set(
      currentMetadata.items.map((item) => buildItemKey(item)).filter((key): key is string => Boolean(key))
    );

    const newItems: RssMetadataItem[] = [];
    const createdFilePaths: string[] = [];
    let addedCount = 0;
    let metadataCommitted = false;
    try {
      for (const item of feed.items || []) {
        const title = item.title?.trim() || "Untitled";
        const publicationDate = item.isoDate || item.pubDate;
        const published = publicationDate ? formatDate(publicationDate) || undefined : undefined;
        const link = item.link?.trim();
        const guidValue = typeof item.guid === "string" ? item.guid : undefined;
        const idValue = typeof item.id === "string" ? item.id : undefined;
        const guid = guidValue?.trim() || idValue?.trim();
        const key = buildItemKey({ guid, link, title, published });

        if (key && existingKeys.has(key)) {
          continue;
        }

        const datePrefix = published || "undated";
        const fileBaseName = `${datePrefix}-${title}`;
        const fileName = await getAvailableFileName(folderPath, fileBaseName);
        const filePath = path.join(folderPath, fileName);
        assertSubscriptionGeneration(state, generation);

        const metadata = buildCommentMetadata({
          "rss-title": title,
          "rss-link": link,
          "rss-guid": guid,
          "rss-published": published,
          "rss-source": feedTitle
        });
        const mediaBlock = buildMediaBlock(getMediaEntries(item));
        const content = pickItemContent(item);
        const heading = `# ${title}\n\n`;
        const markdown = `${metadata}${heading}${mediaBlock}${content}`;

        await fileSystem.createFile(filePath, markdown);
        createdFilePaths.push(filePath);
        assertSubscriptionGeneration(state, generation);

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

      currentMetadata.title = feedTitle;
      currentMetadata.lastFetched = new Date().toISOString();
      currentMetadata.items = [...currentMetadata.items, ...newItems];

      assertSubscriptionGeneration(state, generation);
      await saveRssMetadata(folderPath, currentMetadata);
      metadataCommitted = true;
      assertSubscriptionGeneration(state, generation);
    } catch (error) {
      // If unsubscribe fails after a metadata commit, its item references must still point at existing files.
      if (!metadataCommitted) {
        await Promise.all(createdFilePaths.map((filePath) => fs.rm(filePath, { force: true }).catch(() => {})));
      }
      throw error;
    }

    return { addedCount };
  });
}

export async function unsubscribeRss(folderPath: string): Promise<void> {
  const operation = beginSubscriptionOperation(folderPath);
  // Invalidate immediately; cancellation must not wait for the remote feed response.
  operation.state.generation += 1;
  try {
    await commitSubscriptionOperation(operation.state, async () => {
      const metadataPath = path.join(folderPath, ".rss.json");
      const exists = await fileSystem.exists(metadataPath);
      if (!exists) return;
      await fileSystem.deleteFile(metadataPath);
    });
  } finally {
    operation.release();
  }
}
