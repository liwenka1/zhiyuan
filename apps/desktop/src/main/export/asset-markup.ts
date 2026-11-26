import { JSDOM } from "jsdom";
import { createUrlTransformer, isLocalAbsolutePath, isRelativePath } from "@shared";
import type { WorkspacePathScope } from "../security/path-validator";
import { rewriteCssResources } from "./css-resources";

export type ExportAssetType = "image" | "media" | "css" | "attachment";
export type ExportAssetTarget = "capture" | "html" | "clipboard";

export function isLocalExportReference(source: string): boolean {
  return /^(file|local-resource|local-media):/i.test(source) || isLocalAbsolutePath(source) || isRelativePath(source);
}

export function isDataUrl(source: string): boolean {
  let start = 0;
  while (source.charCodeAt(start) <= 0x20) start += 1;
  return /^d[\t\r\n]*a[\t\r\n]*t[\t\r\n]*a[\t\r\n]*:/i.test(source.slice(start));
}

type AssetReplacement = string | { url: string; download: string } | null | undefined;
type ReplaceAsset = (source: string, type: ExportAssetType) => AssetReplacement | Promise<AssetReplacement>;

export async function rewriteExportAssets(
  html: string,
  target: ExportAssetTarget,
  replace: ReplaceAsset,
  { workspace, missingLabel }: { workspace?: string | WorkspacePathScope; missingLabel?: string } = {}
): Promise<string> {
  const isDocument = /<(?:!doctype|html|head|body)(?:\s|>)/i.test(html);
  const dom = new JSDOM(isDocument ? html : "");
  const template = isDocument ? null : dom.window.document.createElement("template");
  if (template) template.innerHTML = html;
  const root = template?.content ?? dom.window.document;
  const scope = typeof workspace === "string" ? { workspacePath: workspace } : workspace;
  const resolve = createUrlTransformer(undefined, { ...scope, syntax: "html" });
  const normalize = (source: string) => (source.startsWith("//") ? resolve(source) : source);
  const replaceResource = async (source: string, type: ExportAssetType) => {
    const normalized = normalize(source);
    const replacement = await replace(normalized, type);
    return replacement === undefined && normalized !== source ? normalized : replacement;
  };
  try {
    const replaceAttribute = async (element: Element, attribute: string, type: ExportAssetType) => {
      const source = element.getAttribute(attribute);
      if (!source?.trim()) return;
      const next = await replaceResource(source.trim(), type);
      if (next === undefined || next === source) return;
      if (next !== null) {
        element.setAttribute(attribute, typeof next === "string" ? next : next.url);
        if (typeof next === "object") element.setAttribute("download", next.download);
        return;
      }
      element.removeAttribute(attribute);
      if (missingLabel && type === "image" && element.tagName === "IMG") {
        const alt = element.getAttribute("alt");
        const placeholder = dom.window.document.createElement("span");
        placeholder.textContent = alt ? `${alt} (${missingLabel})` : missingLabel;
        element.replaceWith(placeholder);
      }
    };

    for (const element of root.querySelectorAll("img[src], video[poster]")) {
      await replaceAttribute(element, element.tagName === "IMG" ? "src" : "poster", "image");
    }
    for (const element of root.querySelectorAll("image")) {
      if (element.namespaceURI !== "http://www.w3.org/2000/svg") continue;
      const attribute = element.hasAttribute("href") ? "href" : "xlink:href";
      if (attribute === "href") element.removeAttribute("xlink:href");
      await replaceAttribute(element, attribute, "image");
    }
    for (const element of root.querySelectorAll("video, audio, source")) {
      for (const attribute of ["src", "href"]) {
        if (target === "capture") element.removeAttribute(attribute);
        else await replaceAttribute(element, attribute, "media");
      }
    }

    const replaceCssUrl = async (source: string) => {
      const replacement = await replaceResource(source, "css");
      return replacement && typeof replacement === "object" ? replacement.url : replacement;
    };
    for (const element of root.querySelectorAll("[style], style")) {
      const style = element.getAttribute("style");
      if (style) element.setAttribute("style", await rewriteCssResources(style, "declarationList", replaceCssUrl));
      if (element.localName === "style" && element.textContent) {
        element.textContent = await rewriteCssResources(element.textContent, "stylesheet", replaceCssUrl);
      }
    }

    for (const element of root.querySelectorAll("a[href]")) {
      const href = element.getAttribute("href")?.trim();
      if (href) {
        const normalized = normalize(href);
        if (target === "clipboard" && (isLocalExportReference(normalized) || isDataUrl(normalized))) {
          await replaceAttribute(element, "href", "attachment");
        } else if (isLocalExportReference(normalized)) {
          element.removeAttribute("href");
        } else if (normalized !== href) {
          element.setAttribute("href", normalized);
        }
      }
    }
    for (const element of root.querySelectorAll("[srcset]")) {
      // The Markdown sanitizer only enables src. Supplemental sources cannot override the reviewed image.
      element.removeAttribute("srcset");
    }
    return template?.innerHTML ?? dom.serialize();
  } finally {
    dom.window.close();
  }
}
