import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { createUrlTransformer, decodeLocalResourceUrl } from "@shared";
import { validatePathInWorkspace } from "../security/path-validator";

function parseAssetHtml(html: string) {
  const isDocument = /<(?:!doctype|html|head|body)(?:\s|>)/i.test(html);
  const dom = new JSDOM(isDocument ? html : "");
  const template = isDocument ? null : dom.window.document.createElement("template");
  if (template) template.innerHTML = html;
  return {
    dom,
    root: template?.content ?? dom.window.document,
    serialize: () => template?.innerHTML ?? dom.serialize()
  };
}

function resolveLocalAsset(source: string, notePath: string, workspacePath: string) {
  try {
    const reference = createUrlTransformer(notePath)(source);
    const url = new URL(reference);
    const filePath =
      url.protocol === "local-resource:"
        ? decodeLocalResourceUrl(reference)
        : url.protocol === "file:"
          ? fileURLToPath(url)
          : null;
    if (!filePath) return null;
    const validation = validatePathInWorkspace(workspacePath, filePath);
    if (!validation.isValid) return null;
    url.searchParams.delete("__window");
    return { filePath: validation.normalizedPath, search: url.search, hash: url.hash };
  } catch {
    return null;
  }
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
export async function embedLocalImages(
  htmlContent: string,
  notePath?: string,
  workspacePath?: string
): Promise<string> {
  if (!notePath || !workspacePath) return htmlContent;

  const document = parseAssetHtml(htmlContent);
  try {
    for (const element of document.root.querySelectorAll("img[src]")) {
      // DOM attributes decode HTML entities exactly once; URLs perform their own path decoding.
      const asset = resolveLocalAsset(element.getAttribute("src")!, notePath, workspacePath);
      if (!asset) continue;
      const imageBuffer = await fs.readFile(asset.filePath).catch(() => null);
      if (!imageBuffer) continue;
      const mimeType = getImageMimeType(path.extname(asset.filePath));
      element.setAttribute("src", `data:${mimeType};base64,${imageBuffer.toString("base64")}${asset.hash}`);
    }
    return document.serialize();
  } finally {
    document.dom.window.close();
  }
}

/**
 * 收集并复制 HTML 中的资源文件（图片、视频等）
 */
export async function collectAndCopyAssets(
  html: string,
  notePath: string,
  assetsDir: string,
  assetsFolderName: string,
  workspacePath?: string
): Promise<{ processedHtml: string; copiedFiles: string[] }> {
  if (!workspacePath) return { processedHtml: html, copiedFiles: [] };

  const copiedFiles: string[] = [];
  const copiedFileNames = new Set<string>();
  const copies = new Map<string, Promise<string | null>>();
  const copyAsset = (sourcePath: string): Promise<string | null> => {
    const existing = copies.get(sourcePath);
    if (existing) return existing;
    const ext = path.extname(sourcePath);
    const basename = path.basename(sourcePath, ext);
    let fileName = `${basename}${ext}`;
    let counter = 1;

    while (copiedFileNames.has(fileName.normalize("NFC").toLowerCase())) {
      fileName = `${basename}-${counter}${ext}`;
      counter++;
    }

    copiedFileNames.add(fileName.normalize("NFC").toLowerCase());

    const destPath = path.join(assetsDir, fileName);
    const copying = fs.copyFile(sourcePath, destPath).then(
      () => {
        copiedFiles.push(destPath);
        const folderSegment = encodeURIComponent(assetsFolderName).replaceAll("'", "%27");
        const fileSegment = encodeURIComponent(fileName).replaceAll("'", "%27");
        return `./${folderSegment}/${fileSegment}`;
      },
      () => null
    );
    copies.set(sourcePath, copying);
    return copying;
  };

  const document = parseAssetHtml(html);
  try {
    await Promise.all(
      [...document.root.querySelectorAll("img, video, audio, source")].map(async (element) => {
        for (const attribute of ["src", "href"]) {
          const source = element.getAttribute(attribute);
          if (!source) continue;
          const asset = resolveLocalAsset(source, notePath, workspacePath);
          if (!asset) continue;
          const copiedUrl = await copyAsset(asset.filePath);
          if (copiedUrl) element.setAttribute(attribute, `${copiedUrl}${asset.search}${asset.hash}`);
        }
      })
    );
    return { processedHtml: document.serialize(), copiedFiles };
  } finally {
    document.dom.window.close();
  }
}
