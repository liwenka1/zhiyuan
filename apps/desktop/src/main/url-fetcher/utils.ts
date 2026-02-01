/**
 * URL Fetcher 工具函数
 * 复用 RSS 模块的命名和格式化逻辑
 */

const INVALID_NAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * 清理文件/文件夹名称中的非法字符
 */
export function sanitizeName(name: string): string {
  return name.replace(INVALID_NAME_CHARS, "-").replace(/\s+/g, " ").trim();
}

/**
 * 格式化当前日期为 YYYY-MM-DD 格式
 */
export function formatDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 转义 YAML 值中的特殊字符
 */
export function escapeYamlValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * 构建笔记的 Frontmatter
 */
export function buildFrontmatter(data: { title: string; url: string; fetchedAt: string }): string {
  const lines: string[] = ["---"];
  lines.push("hidden: true");
  lines.push(`title: "${escapeYamlValue(data.title)}"`);
  lines.push(`url: "${escapeYamlValue(data.url)}"`);
  lines.push(`fetched: "${data.fetchedAt}"`);
  lines.push("---", "");
  return lines.join("\n");
}
