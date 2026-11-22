/**
 * URL Fetcher 主模块
 * 从 URL 抓取网页内容并创建笔记
 */

import path from "path";
import { fileSystem } from "../file-system";
import { fetchArticleFromUrl } from "./fetcher";
import { sanitizeName, formatDate, buildCommentMetadata } from "../utils/content-import";

export interface UrlFetchResult {
  noteId: string;
  filePath: string;
  title: string;
}

/**
 * 使用独占创建分配文件名，允许同标题文章并发导入。
 */
async function createAvailableFile(folderPath: string, baseName: string, content: string): Promise<string> {
  const normalizedBase = sanitizeName(baseName) || "untitled";
  for (let index = 1; index < 10_000; index++) {
    const fileName = index === 1 ? `${normalizedBase}.md` : `${normalizedBase}-${index}.md`;
    try {
      await fileSystem.createFile(path.join(folderPath, fileName), content);
      return fileName;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("Cannot resolve unique target file name");
}

/**
 * 从 URL 抓取网页内容并创建笔记
 * @param url - 网页 URL
 * @param workspacePath - 工作区路径
 * @param folderId - 可选，目标文件夹 ID（相对路径）
 * @returns 创建的笔记信息
 */
export async function createNoteFromUrl(
  url: string,
  workspacePath: string,
  folderId?: string
): Promise<UrlFetchResult> {
  // 1. 抓取网页内容
  const article = await fetchArticleFromUrl(url);

  // 2. 构建笔记内容（和 RSS 一样，直接保存 HTML）
  const title = article.title;
  const fetchedAt = new Date().toISOString();
  const metadata = buildCommentMetadata({
    "web-title": title,
    "web-url": url,
    "web-fetched-at": fetchedAt
  });

  const heading = `# ${title}\n\n`;
  const content = article.content; // HTML 内容，不转换
  const markdown = `${metadata}${heading}${content}`;

  // 3. 确定保存路径
  const targetFolder = folderId ? path.join(workspacePath, folderId) : workspacePath;

  // 确保目标文件夹存在
  if (!(await fileSystem.exists(targetFolder))) {
    throw new Error("Target folder does not exist");
  }

  // 4. 生成文件名并保存
  const datePrefix = formatDate() || "undated";
  const fileBaseName = `${datePrefix}-${title}`;
  const fileName = await createAvailableFile(targetFolder, fileBaseName, markdown);
  const filePath = path.join(targetFolder, fileName);

  // 5. 返回结果
  const noteId = folderId ? `${folderId}/${fileName}` : fileName;

  return {
    noteId: noteId.replace(/\.md$/, ""),
    filePath,
    title
  };
}

// 重新导出相关类型和函数
export { fetchArticleFromUrl } from "./fetcher";
export type { ArticleContent } from "./fetcher";
