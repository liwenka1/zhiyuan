import { decodeLocalResourceUrl, isLocalAbsolutePath, isRelativePath, resolveLocalPath } from "@shared";

export interface MarkdownAsset {
  originalUrl: string;
  localPath: string;
}

const LINK_REGEX = /(!?\[[^\]]*\]\()([^)]+)(\))/g;

export function collectLocalMarkdownAssets(markdown: string, notePath?: string): MarkdownAsset[] {
  const assets: MarkdownAsset[] = [];
  if (!markdown) return assets;

  const matches = markdown.matchAll(LINK_REGEX);
  for (const match of matches) {
    const rawUrl = match[2];
    if (!rawUrl) continue;

    const normalized = rawUrl.trim();
    if (!normalized) continue;

    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      const unquoted = normalized.slice(1, -1).trim();
      if (!unquoted) continue;
      if (/^(https?:|data:|blob:|mailto:|#)/i.test(unquoted)) continue;

      if (unquoted.startsWith("local-resource://")) {
        const localPath = decodeLocalResourceUrl(unquoted);
        assets.push({ originalUrl: rawUrl, localPath });
        continue;
      }

      if (unquoted.startsWith("file://")) {
        const localPath = decodeURIComponent(unquoted.replace(/^file:\/\//, ""));
        assets.push({ originalUrl: rawUrl, localPath });
        continue;
      }

      if (isLocalAbsolutePath(unquoted)) {
        assets.push({ originalUrl: rawUrl, localPath: unquoted });
        continue;
      }

      if (notePath && isRelativePath(unquoted)) {
        assets.push({ originalUrl: rawUrl, localPath: resolveLocalPath(unquoted, notePath) });
      }

      continue;
    }

    if (/^(https?:|data:|blob:|mailto:|#)/i.test(normalized)) continue;

    if (normalized.startsWith("local-resource://")) {
      const localPath = decodeLocalResourceUrl(normalized);
      assets.push({ originalUrl: rawUrl, localPath });
      continue;
    }

    if (normalized.startsWith("file://")) {
      const localPath = decodeURIComponent(normalized.replace(/^file:\/\//, ""));
      assets.push({ originalUrl: rawUrl, localPath });
      continue;
    }

    if (isLocalAbsolutePath(normalized)) {
      assets.push({ originalUrl: rawUrl, localPath: normalized });
      continue;
    }

    if (notePath && isRelativePath(normalized)) {
      assets.push({ originalUrl: rawUrl, localPath: resolveLocalPath(normalized, notePath) });
    }
  }

  return assets;
}

export function replaceMarkdownAssetUrls(markdown: string, replacements: Map<string, string>): string {
  let result = markdown;
  replacements.forEach((nextUrl, originalUrl) => {
    const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), nextUrl);
  });
  return result;
}
