import { JSDOM } from "jsdom";
import { createUrlTransformer, isLocalAbsolutePath, isRelativePath } from "@shared";
import type { WorkspacePathScope } from "../security/path-validator";
import { rewriteCssResources } from "./css-resources";

export type ExportAssetType = "image" | "media" | "css";
export type ExportAssetTarget = "capture" | "html";

export function isLocalExportReference(source: string): boolean {
  return /^(file|local-resource|local-media):/i.test(source) || isLocalAbsolutePath(source) || isRelativePath(source);
}

type ReplaceAsset = (
  source: string,
  type: ExportAssetType
) => string | null | undefined | Promise<string | null | undefined>;

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
        element.setAttribute(attribute, next);
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
    for (const element of root.querySelectorAll("video, audio, source")) {
      for (const attribute of ["src", "href"]) {
        if (target === "capture") element.removeAttribute(attribute);
        else await replaceAttribute(element, attribute, "media");
      }
    }

    const replaceCssUrl = (source: string) => replaceResource(source, "css");
    for (const element of root.querySelectorAll("[style], style")) {
      const style = element.getAttribute("style");
      if (style) element.setAttribute("style", await rewriteCssResources(style, "declarationList", replaceCssUrl));
      if (element.localName === "style" && element.textContent) {
        element.textContent = await rewriteCssResources(element.textContent, "stylesheet", replaceCssUrl);
      }
    }

    for (const element of root.querySelectorAll("a[href], [srcset]")) {
      const href = element.getAttribute("href")?.trim();
      if (href) {
        const normalized = normalize(href);
        if (isLocalExportReference(normalized)) element.removeAttribute("href");
        else if (normalized !== href) element.setAttribute("href", normalized);
      }
      // The Markdown sanitizer only enables src. Supplemental sources cannot override the reviewed image.
      element.removeAttribute("srcset");
    }
    return template?.innerHTML ?? dom.serialize();
  } finally {
    dom.window.close();
  }
}
