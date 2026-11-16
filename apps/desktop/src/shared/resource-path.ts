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

function localResourceUrl(filePath: string): string {
  const normalized = normalizePath(filePath);
  const encoded = encodeURI(normalized).replaceAll("?", "%3F").replaceAll("#", "%23");
  return `local-resource://${normalized.startsWith("/") ? "" : "/"}${encoded}`;
}

function decodeResourcePath(value: string): string {
  // URL 路径只解码一次；未转义的百分号仍可以是合法文件名。
  return value.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
}

function splitResourceReference(value: string): { pathname: string; suffix: string } {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex < 0
    ? { pathname: value, suffix: "" }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : normalized;
}

export function resolveResourcePath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const { pathname, suffix } = splitResourceReference(src);
  const decodedSrc = decodeResourcePath(pathname);
  const cleanSrc = decodedSrc.replace(/^\.\//, "");
  const fullPath = `${noteDir}/${cleanSrc}`;

  return `${localResourceUrl(fullPath)}${suffix}`;
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
      // 绝对路径来自本地文件系统，#、?、% 都属于文件名。
      return localResourceUrl(url);
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
      return `${prefix}${localResourceUrl(trimmed)}${suffix}`;
    }

    if (/\s/.test(trimmed)) {
      const reference = splitResourceReference(trimmed);
      const encodedPath = encodeURI(decodeResourcePath(reference.pathname))
        .replaceAll("#", "%23")
        .replaceAll("?", "%3F");
      return `${prefix}${encodedPath}${reference.suffix}${suffix}`;
    }

    return match;
  });
}

export function decodeLocalResourceUrl(url: string): string {
  if (!url.startsWith("local-resource://")) return url;
  const parsed = new URL(url);
  const decodedPath = decodeURIComponent(parsed.pathname);
  // 兼容旧版 Windows URL，同时为新版 hostless URL 保留盘符。
  const legacyDrive = /^local-resource:\/\/([A-Za-z]):\//.exec(url)?.[1];
  if (legacyDrive) return `${legacyDrive}:${decodedPath}`;
  if (/^\/[A-Za-z]:\//.test(decodedPath)) return decodedPath.slice(1);
  return parsed.hostname && parsed.hostname !== "localhost" ? `/${parsed.hostname}${decodedPath}` : decodedPath;
}

/** 窗口 capability 只进入渲染 URL，不写入 Markdown 正文。 */
export function authorizeLocalResourceUrl(url: string, token: string): string {
  if (!url.startsWith("local-resource://")) return url;
  const original = new URL(url);
  const authorized = new URL(localResourceUrl(decodeLocalResourceUrl(url)));
  authorized.search = original.search;
  authorized.hash = original.hash;
  authorized.searchParams.set("__window", token);
  return authorized.href;
}
