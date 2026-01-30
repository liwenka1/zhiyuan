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

type RssItem = Parser.Item & { "content:encoded"?: string; description?: string };

const INVALID_NAME_CHARS = /[\\/:*?"<>|]/g;

function sanitizeName(name: string): string {
  return name.replace(INVALID_NAME_CHARS, "-").replace(/\s+/g, " ").trim();
}

function formatDate(dateValue?: string): string | null {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeYamlValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

function buildFrontmatter(data: {
  title?: string;
  link?: string;
  guid?: string;
  published?: string;
  source?: string;
  hidden?: boolean;
}): string {
  const lines: string[] = ["---"];

  if (data.hidden) lines.push("hidden: true");
  if (data.title) lines.push(`title: "${escapeYamlValue(data.title)}"`);
  if (data.link) lines.push(`link: "${escapeYamlValue(data.link)}"`);
  if (data.guid) lines.push(`guid: "${escapeYamlValue(data.guid)}"`);
  if (data.published) lines.push(`published: "${data.published}"`);
  if (data.source) lines.push(`source: "${escapeYamlValue(data.source)}"`);

  lines.push("---", "");
  return lines.join("\n");
}

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

function pickItemContent(item: RssItem): string {
  const content =
    item["content:encoded"] || item.content || item.summary || item.contentSnippet || item.description || "";
  return typeof content === "string" ? content.trim() : "";
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
  const parser: Parser<RssItem> = new Parser();
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
    const content = pickItemContent(item);
    const heading = `# ${title}\n\n`;
    const markdown = `${frontmatter}${heading}${content}`;

    await fileSystem.createFile(filePath, markdown);

    metadataItems.push({
      guid,
      link,
      published: published ? new Date(published).toISOString() : undefined,
      title
    });
  }

  const metadata = {
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
