/**
 * 资源路径解析工具
 * 供主进程与渲染进程共用
 */

export function isRelativePath(src: string): boolean {
  if (!src) return false;
  if (/^(https?:|data:|file:|blob:|#|mailto:|local-resource:)/.test(src)) return false;
  if (/^(\/|[A-Za-z]:)/.test(src)) return false;
  return true;
}

export function isLocalAbsolutePath(src: string): boolean {
  if (!src) return false;
  return /^(\/|[A-Za-z]:[/\\])/.test(src);
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/");
}

function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

export function resolveResourcePath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const decodedSrc = decodeURI(src);
  const cleanSrc = decodedSrc.replace(/^\.\//, "");
  const fullPath = `${noteDir}/${cleanSrc}`;

  return `local-resource://${encodeURI(fullPath)}`;
}

export function resolveLocalPath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const cleanSrc = src.replace(/^\.\//, "");

  return `${noteDir}/${cleanSrc}`;
}

export function createUrlTransformer(notePath: string | undefined) {
  return (url: string): string => {
    if (url.startsWith("local-resource://")) {
      return url;
    }

    if (isLocalAbsolutePath(url)) {
      return `local-resource://${encodeURI(url)}`;
    }

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
    const isAbsolute = isLocalAbsolutePath(trimmed);
    const isRelative = isRelativePath(trimmed);

    if (!isAbsolute && !isRelative) return match;

    if (isAbsolute) {
      return `${prefix}local-resource://${encodeURI(trimmed)}${suffix}`;
    }

    if (/\s/.test(trimmed)) {
      return `${prefix}${encodeURI(trimmed)}${suffix}`;
    }

    return match;
  });
}

export function decodeLocalResourceUrl(url: string): string {
  if (!url.startsWith("local-resource://")) return url;
  const decoded = decodeURIComponent(url.replace(/^local-resource:\/\//, ""));
  return decoded.replace(/^localhost/, "");
}
