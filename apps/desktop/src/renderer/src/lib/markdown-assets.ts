import { createUrlTransformer, decodeLocalResourceUrl } from "@shared";
import { getInlineMarkdownDestinations, rewriteMarkdownDestinations } from "./markdown-links";

export interface MarkdownAsset {
  originalUrl: string;
  localPath: string;
  start: number;
  end: number;
}

export function collectLocalMarkdownAssets(
  markdown: string,
  notePath?: string,
  workspacePath?: string | null
): MarkdownAsset[] {
  const assets: MarkdownAsset[] = [];
  const resolve = createUrlTransformer(notePath, { syntax: "markdown", workspacePath });
  const resolveNative = createUrlTransformer(notePath, { workspacePath });

  for (const destination of getInlineMarkdownDestinations(markdown, workspacePath)) {
    const { originalUrl, start, end, url } = destination;
    // Repaired local destinations are already encoded. An intact wrapper can still enclose an external URL.
    const quoted = /^["']/.test(url) ? originalUrl.match(/^(["'])(.*)\1$/) : null;
    const resource = quoted ? resolveNative(quoted[2].trim()) : resolve(url);
    if (!resource.startsWith("local-resource://")) continue;
    try {
      assets.push({ originalUrl, localPath: decodeLocalResourceUrl(resource), start, end });
    } catch {
      // Ignore malformed resource URLs.
    }
  }
  return assets;
}

export function replaceMarkdownAssetUrls(
  markdown: string,
  assets: readonly MarkdownAsset[],
  replacements: ReadonlyMap<string, string>
): string {
  return rewriteMarkdownDestinations(markdown, assets, ({ originalUrl }) =>
    replacements.get(originalUrl)?.replaceAll("(", "%28").replaceAll(")", "%29")
  );
}
