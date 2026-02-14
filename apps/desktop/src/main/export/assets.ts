import * as fs from "fs/promises";
import * as path from "path";

/**
 * 判断是否为相对路径
 */
export function isRelativePath(src: string): boolean {
  if (!src) return false;
  if (/^(https?:|data:|file:|blob:|#|mailto:|local-resource:)/.test(src)) return false;
  return true;
}

/**
 * 获取图片的 MIME 类型
 */
export function getImageMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon"
  };
  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}

/**
 * 将 HTML 中的本地图片转换为 Base64 内嵌
 * 支持相对路径和 local-resource:// 协议
 */
export async function embedLocalImages(htmlContent: string, notePath?: string): Promise<string> {
  if (!notePath) return htmlContent;

  const noteDir = path.dirname(notePath);
  let result = htmlContent;

  const imgRegex = /<img[^>]+src=(["]|['])([^"']+)\1[^>]*>/gi;
  const matches = [...htmlContent.matchAll(imgRegex)];

  for (const match of matches) {
    const fullMatch = match[0];
    const quote = match[1];
    const src = match[2];

    let imagePath: string;
    if (src.startsWith("local-resource://")) {
      const urlPath = src.replace(/^local-resource:\/\//, "");
      imagePath = decodeURIComponent(urlPath.replace(/^localhost/, ""));
    } else if (isRelativePath(src)) {
      imagePath = path.resolve(noteDir, src.replace(/^\.\//, ""));
    } else {
      continue;
    }

    try {
      await fs.access(imagePath);
    } catch {
      continue;
    }

    const imageBuffer = await fs.readFile(imagePath).catch(() => null);
    if (!imageBuffer) continue;

    const ext = path.extname(imagePath);
    const mimeType = getImageMimeType(ext);
    const base64 = imageBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    const newImgTag = fullMatch.replace(`src=${quote}${src}${quote}`, `src=${quote}${dataUri}${quote}`);
    result = result.replace(fullMatch, newImgTag);
  }

  return result;
}

/**
 * 收集并复制 HTML 中的资源文件（图片、视频等）
 */
export async function collectAndCopyAssets(
  html: string,
  notePath: string,
  assetsDir: string,
  assetsFolderName: string
): Promise<{ processedHtml: string; copiedFiles: string[] }> {
  const noteDir = path.dirname(notePath);
  const copiedFiles: string[] = [];
  const fileMap = new Map<string, string>();
  const copiedFileNames = new Set<string>();

  const resourceRegex = /<(img|video|audio|source)[^>]+(src|href)=(["'])([^"']+)\3[^>]*>/gi;
  const matches = html.matchAll(resourceRegex);

  const promises = Array.from(matches).map(async (match) => {
    const src = match[4];

    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return;
    }

    let sourcePath: string;
    if (src.startsWith("local-resource://")) {
      const urlPath = src.replace(/^local-resource:\/\//, "");
      sourcePath = decodeURIComponent(urlPath.replace(/^localhost/, ""));
    } else if (src.startsWith("file://")) {
      sourcePath = decodeURIComponent(src.replace(/^file:\/\//, ""));
    } else if (isRelativePath(src)) {
      sourcePath = path.resolve(noteDir, src.replace(/^\.\//, ""));
    } else {
      return;
    }

    try {
      await fs.access(sourcePath);
    } catch {
      return;
    }

    const ext = path.extname(sourcePath);
    const basename = path.basename(sourcePath, ext);
    let fileName = `${basename}${ext}`;
    let counter = 1;

    while (copiedFileNames.has(fileName)) {
      fileName = `${basename}-${counter}${ext}`;
      counter++;
    }

    copiedFileNames.add(fileName);

    const destPath = path.join(assetsDir, fileName);
    const copied = await fs.copyFile(sourcePath, destPath).then(
      () => true,
      () => false
    );
    if (copied) {
      copiedFiles.push(destPath);
      const relativePath = `./${assetsFolderName}/${fileName}`;
      fileMap.set(src, relativePath);
    }
  });

  await Promise.all(promises);

  let processedHtml = html;
  fileMap.forEach((newPath, oldPath) => {
    const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    processedHtml = processedHtml.replace(new RegExp(escapedOldPath, "g"), newPath);
  });

  return { processedHtml, copiedFiles };
}
