import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeLocalResourcesInHtml } from "../../apps/desktop/src/renderer/src/lib/local-resource";
import { decodeLocalResourceUrl } from "@shared";
import { resolveAuthorizedLocalResource } from "../../apps/desktop/src/main/security/local-resource";
import { embedLocalImages } from "../../apps/desktop/src/main/export/assets";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as {
  JSDOM: new () => { window: { DOMParser: typeof DOMParser } };
};

describe("rendered local resource capabilities", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds the preload capability to Markdown preview and export output after resolving relative paths", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const markdown = "![photo](./photo.png)\n\n[icon](local-resource:///workspace/icon.svg?size=large#symbol)";
    const html = await markdownToHTML(markdown, { notePath: "/workspace/note.md", enableCopyButton: false });
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector("img")?.getAttribute("src")).toBe(
      "local-resource:///workspace/photo.png?__window=preload-window"
    );
    const link = new URL(document.querySelector("a")!.getAttribute("href")!);
    expect(link.searchParams.get("__window")).toBe("preload-window");
    expect(link.searchParams.get("size")).toBe("large");
    expect(link.hash).toBe("#symbol");
    expect(markdown).not.toContain("preload-window");
  });

  it.each(["relative", "absolute"])(
    "resolves special filenames from real %s Markdown into readable resources",
    async (kind) => {
      const dom = new JSDOM();
      vi.stubGlobal("DOMParser", dom.window.DOMParser);
      vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-markdown-resources-"));
      try {
        const workspace = await fs.realpath(root);
        const names = ["photo#one.png", "photo%one.png", "literal%23.png", "中文 空格.png"];
        if (process.platform !== "win32") names.push("photo?one.png");
        await Promise.all(names.map((name) => fs.writeFile(path.join(workspace, name), name)));
        await fs.writeFile(path.join(workspace, "icons.svg"), "<svg></svg>");
        const markdown =
          names
            .map(
              (name) =>
                `![photo](${kind === "relative" ? `./${encodeURIComponent(name)}` : path.join(workspace, name)})`
            )
            .join("\n\n") + "\n\n![svg](./icons.svg#symbol)";
        const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
        const html = await markdownToHTML(markdown, {
          notePath: path.join(workspace, "note.md"),
          enableCopyButton: false
        });
        const document = new DOMParser().parseFromString(html, "text/html");
        const urls = [...document.querySelectorAll("img")].map((img) => img.getAttribute("src")!);
        expect(urls).toHaveLength(names.length + 1);
        for (let index = 0; index < names.length; index++) {
          const actual = resolveAuthorizedLocalResource(urls[index], (token) =>
            token === "preload-window" ? workspace : null
          );
          expect(actual).toBe(path.join(workspace, names[index]));
          expect(await fs.readFile(actual!, "utf8")).toBe(names[index]);
        }
        expect(new URL(urls.at(-1)!).hash).toBe("#symbol");
        expect(resolveAuthorizedLocalResource(urls.at(-1)!, () => workspace)).toBe(path.join(workspace, "icons.svg"));
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    }
  );

  it("resolves note-relative encoded images in ordinary, section and WeChat exports before embedding", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-resources-"));
    try {
      const workspace = await fs.realpath(root);
      const names = ["图片 空格.png", "photo#one.png", "literal%23.png"];
      await Promise.all(names.map((name) => fs.writeFile(path.join(workspace, name), "image")));
      const note = {
        id: "note",
        title: "Note",
        filePath: path.join(workspace, "note.md"),
        content: names.map((name) => `![photo](./${encodeURIComponent(name)})`).join("\n\n")
      };
      const { buildExportDocument, buildExportDocumentsBySections, buildWechatDocument } =
        await import("../../apps/desktop/src/renderer/src/features/export/lib/export-pipeline");
      const documents = [
        await buildExportDocument(note, "html", "default"),
        ...(await buildExportDocumentsBySections(note, "pdf", "default")),
        await buildWechatDocument(note, "default")
      ];
      for (const html of documents) {
        const embedded = await embedLocalImages(html, note.filePath, workspace);
        expect(embedded.match(/src="data:image\/png;base64,aW1hZ2U="/g)).toHaveLength(names.length);
      }
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("authorizes media, links and CSS after rendering and replaces stale capabilities", () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    const html =
      '<img src="local-resource:///workspace/a.png?__window=foreign"><a href="local-resource:///workspace/note.md">note</a><video poster="local-resource:///workspace/poster.png"><source src="local-resource:///workspace/video.mp4"></video><div style="background: url(\'local-resource:///workspace/bg.svg#symbol\')"></div><img srcset="local-resource:///workspace/1.png 1x, local-resource:///workspace/2.png 2x"><img src="https://example.com/image.png">';
    const result = authorizeLocalResourcesInHtml(html, "own-window");
    const document = new DOMParser().parseFromString(result, "text/html");
    for (const element of document.querySelectorAll("[src], [href], [poster]")) {
      for (const attribute of ["src", "href", "poster"]) {
        const url = element.getAttribute(attribute);
        if (url?.startsWith("local-resource://")) {
          expect(new URL(url).searchParams.get("__window")).toBe("own-window");
          expect(decodeLocalResourceUrl(url)).toMatch(/^\/workspace\//);
        }
      }
    }
    expect(document.querySelector("div")?.getAttribute("style")).toContain("__window=own-window");
    expect(document.querySelector("div")?.getAttribute("style")).toContain("#symbol");
    expect(document.querySelector("[srcset]")?.getAttribute("srcset")).toBe(
      "local-resource:///workspace/1.png?__window=own-window 1x, local-resource:///workspace/2.png?__window=own-window 2x"
    );
    expect(document.querySelector('img[src^="https:"]')?.getAttribute("src")).toBe("https://example.com/image.png");
    expect(result).not.toContain("foreign");
    expect(html).not.toContain("own-window");
  });
});
