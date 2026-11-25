/**
 * 资源路径解析工具
 * 供主进程与渲染进程共用
 */

export function isRelativePath(src: string): boolean {
  if (!src) return false;
  return !/^(\/|\\\\|#|[a-z][a-z\d+.-]*:)/i.test(src);
}

export function isLocalAbsolutePath(src: string): boolean {
  if (!src) return false;
  return /^(\/(?!\/)|\\\\|[A-Za-z]:[/\\])/.test(src);
}

function normalizePath(pathValue: string): string {
  return /^(?:[A-Za-z]:[/\\]|\\\\)/.test(pathValue) ? pathValue.replace(/\\/g, "/") : pathValue;
}

export function isWorkspaceUncPath(source: string, workspacePath?: string | null): boolean {
  if (!source.startsWith("//") || !workspacePath) return false;
  const workspace = normalizePath(workspacePath).replace(/\/+$/, "").toLowerCase();
  const candidate = source.toLowerCase();
  return workspace.startsWith("//") && (candidate === workspace || candidate.startsWith(`${workspace}/`));
}

export function localResourceUrl(filePath: string): string {
  // Chromium treats leading path segments as the host on standard schemes without an authority.
  const encoded = encodeURIComponent(normalizePath(filePath)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `local-resource://file/${encoded}`;
}

export function decodeResourcePath(value: string): string {
  // URL 路径只解码一次；未转义的百分号仍可以是合法文件名。
  return value.replace(/(?:%[\da-f]{2})+/gi, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
}

export function splitResourceReference(value: string): { pathname: string; suffix: string } {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex < 0
    ? { pathname: value, suffix: "" }
    : { pathname: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : normalized;
}

export function resolveResourcePath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const { pathname, suffix } = splitResourceReference(src);
  // Bare separators are portable Markdown. An encoded %5C is a literal POSIX filename character.
  const decodedSrc = decodeResourcePath(pathname.replaceAll("\\", "/"));
  const cleanSrc = decodedSrc.replace(/^\.\//, "");
  const fullPath = `${noteDir}/${cleanSrc}`;

  return `${localResourceUrl(fullPath)}${suffix}`;
}

export function resolveLocalPath(src: string, notePath: string): string {
  if (!isRelativePath(src)) return src;

  const noteDir = getDirectory(notePath);
  const cleanSrc = decodeResourcePath(src.replaceAll("\\", "/")).replace(/^\.\//, "");

  return `${noteDir}/${cleanSrc}`;
}

export function createUrlTransformer(
  notePath: string | undefined,
  options?: { syntax?: "markdown" | "html"; workspacePath?: string | null; scannedWorkspacePath?: string | null }
) {
  return (url: string): string => {
    if (/^file:/i.test(url)) {
      try {
        const file = new URL(url);
        if (file.hostname) return url;
        const pathname = decodeURIComponent(file.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
        return isLocalAbsolutePath(pathname) ? `${localResourceUrl(pathname)}${file.search}${file.hash}` : url;
      } catch {
        return url;
      }
    }

    const absolute = isLocalAbsolutePath(url);
    if (absolute || url.startsWith("//")) {
      const { pathname, suffix } = options?.syntax ? splitResourceReference(url) : { pathname: url, suffix: "" };
      const filePath = options?.syntax ? decodeResourcePath(pathname) : pathname;
      if (
        absolute ||
        isWorkspaceUncPath(filePath, options?.workspacePath) ||
        isWorkspaceUncPath(filePath, options?.scannedWorkspacePath)
      ) {
        return localResourceUrl(filePath) + suffix;
      }
      return `https:${url}`;
    }

    if (notePath && isRelativePath(url)) {
      return resolveResourcePath(url, notePath);
    }

    return url;
  };
}

export function decodeLocalResourceUrl(url: string): string {
  if (!url.startsWith("local-resource://")) return url;
  const parsed = new URL(url);
  if (parsed.hostname === "file" && /^\/(?:%2f|[a-z]%3a%2f)[^/]*$/i.test(parsed.pathname)) {
    return decodeURIComponent(parsed.pathname.slice(1));
  }
  const decodedPath = decodeURIComponent(parsed.pathname);
  // 兼容旧版 URL。
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
