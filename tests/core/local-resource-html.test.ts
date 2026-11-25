import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeLocalResourcesInHtml } from "../../apps/desktop/src/renderer/src/lib/local-resource";
import { resolveNoteAbsolutePath } from "../../apps/desktop/src/renderer/src/lib/workspace-paths";
import { authorizeLocalResourceUrl, decodeLocalResourceUrl, localResourceUrl } from "@shared";
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
      "local-resource://file/%2Fworkspace%2Fphoto.png?__window=preload-window"
    );
    const link = new URL(document.querySelector("a")!.getAttribute("href")!);
    expect(link.searchParams.get("__window")).toBe("preload-window");
    expect(link.searchParams.get("size")).toBe("large");
    expect(link.hash).toBe("#symbol");
    expect(markdown).not.toContain("preload-window");
  });

  it("uses the media preview protocol only for preview images and handles network-path references", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const html = await markdownToHTML(
      [
        "![outside](file:///attachments/outside.png)",
        "![web](//example.com/image.png)",
        "[file](../attachments/report.pdf)"
      ].join("\n\n"),
      { notePath: "/workspace/note.md", allowExternalMedia: true }
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector('img[alt="outside"]')?.getAttribute("src")).toBe(
      "local-media://file/%2Fattachments%2Foutside.png?__window=preload-window"
    );
    expect(document.querySelector('img[alt="web"]')?.getAttribute("src")).toBe("https://example.com/image.png");
    const link = document.querySelector("a")!.getAttribute("href")!;
    expect(path.posix.normalize(decodeLocalResourceUrl(link))).toBe("/attachments/report.pdf");
    expect(new URL(link).searchParams.get("__window")).toBe("preload-window");
  });

  it("opens copied UNC workspace paths as local links and keeps other network-path references on HTTPS", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const workspacePath = String.raw`\\SERVER\share\My Notes`;
    const targetPath = resolveNoteAbsolutePath({ id: "reference.md" }, workspacePath);
    const notePath = String.raw`\\SERVER\share\My Notes\nested\current.md`;
    const html = await markdownToHTML(
      [
        `[copied](${targetPath})`,
        "[escaped](//server/share/My%20Notes/reference.md)",
        "[web](//example.com/share/reference.md)",
        "[sibling](//server/share/My%20Notes-other/reference.md)",
        "[explicit](https://server/share/My%20Notes/reference.md)"
      ].join("\n\n"),
      { notePath, workspacePath }
    );
    const document = new DOMParser().parseFromString(html, "text/html");
    const [copied, escaped, ...webLinks] = [...document.querySelectorAll("a")].map(
      (link) => link.getAttribute("href")!
    );
    expect(new URL(copied).protocol).toBe("local-resource:");
    expect(new URL(copied).searchParams.get("__window")).toBe("preload-window");
    expect(decodeLocalResourceUrl(copied)).toBe("//SERVER/share/My Notes/reference.md");
    expect(decodeLocalResourceUrl(escaped)).toBe("//server/share/My Notes/reference.md");
    expect(webLinks).toEqual([
      "https://example.com/share/reference.md",
      "https://server/share/My%20Notes-other/reference.md",
      "https://server/share/My%20Notes/reference.md"
    ]);
  });

  it("preserves encoded filename delimiters in HTML and Markdown reference definitions", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-resource-paths-")));
    try {
      const name = process.platform === "win32" ? "100%-complete #1.svg" : "100%-complete #1?.svg";
      const picture = path.join(root, name);
      await fs.writeFile(picture, `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>`);
      const encoded = `${root.replaceAll("\\", "/")}/${encodeURIComponent(name)}`;
      const markdown = `<img src="${encoded}" alt="HTML">\n\n![Reference][image]\n\n[image]: ${encoded}`;
      const notePath = path.join(root, "note.md");
      const html = await markdownToHTML(markdown, { notePath });
      const document = new DOMParser().parseFromString(html, "text/html");
      const images = [...document.querySelectorAll("img")];
      expect(images).toHaveLength(2);
      for (const image of images) {
        const source = image.getAttribute("src")!;
        expect(resolveAuthorizedLocalResource(source, () => root)).toBe(picture);
        expect(new URL(source).hash).toBe("");
        expect(new URL(source).searchParams.get("__window")).toBe("preload-window");
      }
      expect((await embedLocalImages(html, notePath, root)).match(/data:image\/svg\+xml;base64,/g)).toHaveLength(2);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("decodes URL escapes in absolute HTML image sources once before preview and export", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-escaped-html-")));
    try {
      const names = ["My figure.svg", "My%20figure.svg", "100%-complete.svg"];
      const notePath = path.join(root, "note.md");
      await Promise.all(names.map((name) => fs.writeFile(path.join(root, name), name)));
      const markdown = names
        .map((name, index) => {
          const suffix = index === 0 ? "?size=large&amp;theme=dark#detail" : "";
          const filename = index < 2 ? encodeURIComponent(name) : name;
          return `<img src="${root.replaceAll("\\", "/")}/${filename}${suffix}">`;
        })
        .join("\n\n");
      const html = await markdownToHTML(markdown, { notePath });
      const document = new DOMParser().parseFromString(html, "text/html");
      expect(
        [...document.querySelectorAll("img")].map((image) =>
          resolveAuthorizedLocalResource(image.getAttribute("src")!, () => root)
        )
      ).toEqual(names.map((name) => path.join(root, name)));
      const url = new URL(document.querySelector("img")!.getAttribute("src")!);
      expect(url.searchParams.get("size")).toBe("large");
      expect(url.searchParams.get("theme")).toBe("dark");
      expect(url.hash).toBe("#detail");
      const exported = await embedLocalImages(html, notePath, root);
      for (const name of names)
        expect(exported).toContain(`data:image/svg+xml;base64,${Buffer.from(name).toString("base64")}`);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes actual links and keeps fenced, indented, inline and escaped Markdown examples verbatim", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const example = "![Example]( /notes/figure.png)";
    const exampleWithBackticks = "![Example](/notes/photo `draft`.png)";
    const escaped = "[Example](/notes/figure.png)";
    const markdown = [
      `> \`\`\`md\n> ${example}\n> \`\`\``,
      `    ${example}`,
      `\`${example}\``,
      "``" + exampleWithBackticks + "``",
      `\\${escaped}`,
      example,
      "![Pasted\ncaption](/notes/with spaces (2).png)"
    ].join("\n\n");
    const html = await markdownToHTML(markdown);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect([...document.querySelectorAll("code")].map((code) => code.textContent?.trimEnd())).toEqual([
      example,
      example,
      example,
      exampleWithBackticks
    ]);
    expect([...document.querySelectorAll("p")].some((paragraph) => paragraph.textContent === escaped)).toBe(true);
    expect(
      [...document.querySelectorAll("img")].map((image) => decodeLocalResourceUrl(image.getAttribute("src")!))
    ).toEqual(["/notes/figure.png", "/notes/with spaces (2).png"]);
  });

  it("renders and exports a pasted image after a link separator in inline code", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-pasted-image-"));
    try {
      const workspace = await fs.realpath(root);
      const imagePath = path.join(workspace, "figure copy.svg");
      const image = '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>';
      await fs.writeFile(imagePath, image);
      const note = {
        id: "note",
        title: "Note",
        filePath: path.join(workspace, "note.md"),
        content: `(The separator \`](\` appears before ![Figure](${imagePath}))`
      };
      const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
      const preview = await markdownToHTML(note.content, { notePath: note.filePath, allowExternalMedia: true });
      const document = new DOMParser().parseFromString(preview, "text/html");
      expect(document.querySelector("code")?.textContent).toBe("](");
      const src = document.querySelector("img")?.getAttribute("src");
      expect(src && decodeLocalResourceUrl(src)).toBe(imagePath.replaceAll("\\", "/"));

      const { buildExportDocument } =
        await import("../../apps/desktop/src/renderer/src/features/export/lib/export-pipeline");
      const exported = await buildExportDocument(note, "pdf", "default");
      const embedded = await embedLocalImages(exported, note.filePath, workspace);
      expect(embedded).toContain(`data:image/svg+xml;base64,${Buffer.from(image).toString("base64")}`);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("preserves parentheses in Windows paths and Markdown-delimited paths", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const markdown = [
      String.raw`![Windows](D:\Pictures\(archive)\chart(1).png)`,
      String.raw`![Escaped](/workspace/chart\).png)`,
      "![Delimited](</workspace/chart ).png>)"
    ].join("\n\n");
    const html = await markdownToHTML(markdown);
    const document = new DOMParser().parseFromString(html, "text/html");
    const paths = [...document.querySelectorAll("img")].map((image) =>
      decodeLocalResourceUrl(image.getAttribute("src")!)
    );
    expect(paths).toEqual(["D:/Pictures/(archive)/chart(1).png", "/workspace/chart).png", "/workspace/chart ).png"]);
  });

  it.skipIf(process.platform === "win32")(
    "treats a bare Markdown backslash as a separator and an escaped one as part of the filename",
    async () => {
      const dom = new JSDOM();
      vi.stubGlobal("DOMParser", dom.window.DOMParser);
      const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
      const html = await markdownToHTML("![Nested](assets\\photo.png)\n\n![Literal](assets%5Cphoto.png)", {
        notePath: "/workspace/note.md"
      });
      const document = new DOMParser().parseFromString(html, "text/html");
      const paths = [...document.querySelectorAll("img")].map((image) =>
        decodeLocalResourceUrl(image.getAttribute("src")!)
      );
      expect(paths).toEqual(["/workspace/assets/photo.png", "/workspace/assets\\photo.png"]);
    }
  );

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

  it("resolves encoded images and pasted paths in ordinary, section and WeChat exports before embedding", async () => {
    const dom = new JSDOM();
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "preload-window" } } });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-resources-"));
    try {
      const workspace = await fs.realpath(root);
      const names = ["图片 空格.png", "photo#one.png", "literal%23.png"];
      const pasted = "pasted `draft` image (1).png";
      const quoted = "quoted#part two).png";
      await Promise.all([...names, pasted, quoted].map((name) => fs.writeFile(path.join(workspace, name), "image")));
      const note = {
        id: "note",
        title: "Note",
        filePath: path.join(workspace, "note.md"),
        content: [
          ...names.map((name) => `![photo](./${encodeURIComponent(name)})`),
          `![Pasted \`draft\`\nfigure](${path.join(workspace, pasted)})`,
          `![Quoted]("${path.join(workspace, quoted)}" "Caption")`
        ].join("\n\n")
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
        expect(embedded.match(/src="data:image\/png;base64,aW1hZ2U="/g)).toHaveLength(names.length + 2);
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
    const sources = [1, 2].map(
      (scale) => `${authorizeLocalResourceUrl(localResourceUrl(`/workspace/${scale}.png`), "own-window")} ${scale}x`
    );
    expect(document.querySelector("[srcset]")?.getAttribute("srcset")).toBe(sources.join(", "));
    expect(document.querySelector('img[src^="https:"]')?.getAttribute("src")).toBe("https://example.com/image.png");
    expect(result).not.toContain("foreign");
    expect(html).not.toContain("own-window");
  });
});
