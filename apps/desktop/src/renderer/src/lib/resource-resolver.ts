/**
 * 通用资源路径解析器
 * 将 Markdown 中的相对路径转换为可访问的绝对路径
 */

/**
 * 判断是否为相对路径
 * @param src 资源路径
 * @returns 是否为相对路径
 */
export function isRelativePath(src: string): boolean {
  if (!src) return false;
  // 排除协议路径和 data URI（包括自定义协议 local-resource）
  if (/^(https?:|data:|file:|blob:|#|mailto:|local-resource:)/.test(src)) return false;
  // 排除本地绝对路径（macOS/Linux 以 / 开头，Windows 以盘符开头如 C:\）
  if (/^(\/|[A-Za-z]:)/.test(src)) return false;
  return true;
}

/**
 * 判断是否为本地绝对路径
 * @param src 资源路径
 * @returns 是否为本地绝对路径
 */
export function isLocalAbsolutePath(src: string): boolean {
  if (!src) return false;
  // macOS/Linux: 以 / 开头
  // Windows: 以盘符开头，如 C:\ 或 C:/
  return /^(\/|[A-Za-z]:[/\\])/.test(src);
}

/**
 * 规范化路径分隔符（将 Windows 反斜杠转换为正斜杠）
 * @param path 原始路径
 * @returns 规范化后的路径
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * 获取文件所在目录
 * @param filePath 文件完整路径
 * @returns 目录路径
 */
function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

/**
 * 解析资源的绝对路径（用于渲染进程中显示）
 * 使用自定义协议 local-resource:// 来正确处理中文路径
 * @param src 原始路径（可能是相对路径）
 * @param notePath 笔记的完整文件路径
 * @returns 可访问的绝对 URL（local-resource:// 协议）
 */
export function resolveResourcePath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);

  // 如果路径已经被 encodeURI 编码过（来自 normalizeMarkdownPaths），先解码
  // 这样可以避免双重编码
  const decodedSrc = decodeURI(src);
  const cleanSrc = decodedSrc.replace(/^\.\//, "");
  const fullPath = `${noteDir}/${cleanSrc}`;

  // 使用自定义协议加载本地资源，支持中文路径和特殊字符
  return `local-resource://${encodeURI(fullPath)}`;
}

/**
 * 解析资源的本地文件系统路径（用于导出）
 * @param src 原始路径
 * @param notePath 笔记的完整文件路径
 * @returns 本地文件系统的绝对路径
 */
export function resolveLocalPath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const cleanSrc = src.replace(/^\.\//, "");

  return `${noteDir}/${cleanSrc}`;
}

/**
 * 创建 URL 转换函数（用于 ReactMarkdown 的 urlTransform）
 * @param notePath 笔记的完整文件路径
 * @returns URL 转换函数
 */
export function createUrlTransformer(notePath: string | undefined) {
  return (url: string): string => {
    // 如果已经是 local-resource:// 协议，直接返回（避免重复处理）
    if (url.startsWith("local-resource://")) {
      return url;
    }

    // 本地绝对路径转换为 local-resource:// 协议
    // 例如: /Users/xxx/image.png -> local-resource:///Users/xxx/image.png
    if (isLocalAbsolutePath(url)) {
      return `local-resource://${encodeURI(url)}`;
    }

    // 相对路径转换为基于笔记目录的 local-resource:// 协议
    if (notePath && isRelativePath(url)) {
      return resolveResourcePath(url, notePath);
    }

    return url;
  };
}

export function normalizeMarkdownPaths(markdown: string): string {
  const linkRegex = /(!?\[[^\]]*\]\()([^\s)]+|[^\s)]+[^)]*?)(\))/g;
  return markdown.replace(linkRegex, (match, prefix, rawUrl, suffix) => {
    const trimmed = rawUrl.trim();

    // 如果路径没有空格，不需要处理
    if (!/\s/.test(trimmed)) return match;

    // 检查是否为本地路径（绝对或相对）
    const isAbsolute = isLocalAbsolutePath(trimmed);
    const isRelative = isRelativePath(trimmed);

    if (!isAbsolute && !isRelative) return match;

    const encoded = encodeURI(trimmed);

    // 绝对路径：转换为 local-resource:// 协议
    if (isAbsolute) {
      return `${prefix}local-resource://${encoded}${suffix}`;
    }

    // 相对路径：只编码，不添加协议（后续 createUrlTransformer 会处理）
    return `${prefix}${encoded}${suffix}`;
  });
}
