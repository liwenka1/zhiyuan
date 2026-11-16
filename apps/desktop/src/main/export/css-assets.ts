import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { decodeLocalResourceUrl, isRelativePath } from "@shared";
import { validatePathInWorkspace } from "../security/path-validator";
import { getImageMimeType } from "./assets";

/** Export CSS images use the same workspace boundary as regular Markdown images. */
export async function embedLocalCssImages(html: string, notePath?: string, workspacePath?: string): Promise<string> {
  if (!notePath || !workspacePath || !/url\s*\(/i.test(html)) return html;
  const dom = new JSDOM(html);
  try {
    const embedStyle = async (css: string): Promise<string> => {
      const urls = [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")]*))\s*\)/gi)];
      const replacements = new Map<string, string>();
      await Promise.all(
        urls.map(async (match) => {
          const source = (match[1] ?? match[2] ?? match[3]).trim();
          let filePath: string;
          let fragment = "";
          try {
            if (source.startsWith("local-resource://")) {
              const url = new URL(source);
              filePath = decodeLocalResourceUrl(url.href);
              fragment = url.hash;
            } else if (source.startsWith("file:") || source.startsWith("/") || isRelativePath(source)) {
              const url = new URL(source, pathToFileURL(notePath));
              if (url.protocol !== "file:") return;
              filePath = fileURLToPath(url);
              fragment = url.hash;
            } else {
              return;
            }
            const validation = validatePathInWorkspace(workspacePath, filePath);
            if (!validation.isValid) return;
            const mime = getImageMimeType(path.extname(validation.normalizedPath));
            if (!mime.startsWith("image/")) return;
            const contents = await fs.readFile(validation.normalizedPath);
            replacements.set(match[0], `url("data:${mime};base64,${contents.toString("base64")}${fragment}")`);
          } catch {
            // Invalid, missing and outside files remain blocked by the capture session.
          }
        })
      );
      let result = css;
      for (const [original, embedded] of replacements) result = result.replaceAll(original, () => embedded);
      return result;
    };
    await Promise.all(
      [...dom.window.document.querySelectorAll("[style], style")].map(async (element) => {
        const style = element.getAttribute("style");
        if (style) element.setAttribute("style", await embedStyle(style));
        if (element.tagName.toLowerCase() === "style")
          element.textContent = await embedStyle(element.textContent || "");
      })
    );
    return dom.serialize();
  } finally {
    dom.window.close();
  }
}
