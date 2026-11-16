import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUrlTransformer, decodeLocalResourceUrl } from "@shared";
import { collectAndCopyAssets, embedLocalImages } from "../../apps/desktop/src/main/export/assets";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as typeof import("jsdom");

describe("HTML asset attributes are decoded exactly once", () => {
  let root: string;
  let workspace: string;
  let output: string;
  let notePath: string;
  let browser: InstanceType<typeof JSDOM>;

  const image = (title: string) => `<svg xmlns="http://www.w3.org/2000/svg"><title>${title}</title></svg>`;
  const readHtml = (html: string) => new JSDOM(html);

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-html-entities-"));
    workspace = path.join(root, "workspace");
    output = path.join(root, "export");
    await Promise.all([fs.mkdir(workspace), fs.mkdir(output)]);
    workspace = await fs.realpath(workspace);
    notePath = path.join(workspace, "note.md");
    browser = new JSDOM();
    vi.stubGlobal("DOMParser", browser.window.DOMParser);
    vi.stubGlobal("window", { api: { utils: { getLocalResourceToken: () => "fixture-window" } } });
  });

  afterEach(async () => {
    browser.window.close();
    vi.unstubAllGlobals();
    await fs.rm(root, { recursive: true, force: true });
  });

  it.each([
    ["a&b.svg", "ampersand"],
    ["a&amp;b.svg", "literal entity"],
    ["中文 # % $&.svg", "special filename"]
  ])("embeds and packages the real rendered Markdown reference to %s", async (name, title) => {
    const body = image(title);
    await fs.writeFile(path.join(workspace, name), body);
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const html = await markdownToHTML(`![picture](./${encodeURIComponent(name)})`, {
      notePath,
      enableCopyButton: false
    });
    if (name.includes("&")) expect(html).toContain("&amp;");
    const preview = readHtml(html);
    try {
      const source = preview.window.document.querySelector("img")!.getAttribute("src")!;
      expect(decodeLocalResourceUrl(source)).toBe(path.join(workspace, name));
      expect(await fs.readFile(decodeLocalResourceUrl(source), "utf8")).toBe(body);
    } finally {
      preview.window.close();
    }
    const embedded = readHtml(await embedLocalImages(html, notePath, workspace));
    try {
      const src = embedded.window.document.querySelector("img")!.getAttribute("src")!;
      expect(src).toBe(`data:image/svg+xml;base64,${Buffer.from(body).toString("base64")}`);
    } finally {
      embedded.window.close();
    }

    const folderName = "assets & media";
    const assetsDir = path.join(output, folderName);
    await fs.mkdir(assetsDir);
    const packaged = await collectAndCopyAssets(html, notePath, assetsDir, folderName, workspace);
    expect(packaged.copiedFiles).toHaveLength(1);
    expect(await fs.readFile(packaged.copiedFiles[0], "utf8")).toBe(body);
    const document = readHtml(packaged.processedHtml);
    try {
      const src = document.window.document.querySelector("img")!.getAttribute("src")!;
      const url = new URL(src, pathToFileURL(path.join(output, "index.html")));
      expect(url.searchParams.has("__window")).toBe(false);
      expect(await fs.readFile(fileURLToPath(url), "utf8")).toBe(body);
    } finally {
      document.window.close();
    }
  });

  it("handles quoted attributes and keeps queries and SVG fragments without replacing prose", async () => {
    await fs.writeFile(path.join(workspace, "a&b.svg"), image("quoted"));
    const url = createUrlTransformer(notePath)(path.join(workspace, "a&b.svg"));
    const reference = `${url}?size=large&__window=fixture-window#symbol`;
    const escaped = reference.replaceAll("&", "&amp;");
    const html = `<html><head><title>Assets</title></head><body><p>${escaped}</p><img src='${escaped}'><img src="${escaped}"></body></html>`;
    const embedded = readHtml(await embedLocalImages(html, notePath, workspace));
    try {
      for (const element of embedded.window.document.querySelectorAll("img")) {
        expect(element.getAttribute("src")).toBe(
          `data:image/svg+xml;base64,${Buffer.from(image("quoted")).toString("base64")}#symbol`
        );
      }
    } finally {
      embedded.window.close();
    }
    const assetsDir = path.join(output, "assets");
    await fs.mkdir(assetsDir);
    const packaged = await collectAndCopyAssets(html, notePath, assetsDir, "assets", workspace);
    expect(packaged.copiedFiles).toHaveLength(1);
    const document = readHtml(packaged.processedHtml);
    try {
      expect(document.window.document.querySelector("p")!.textContent).toBe(reference);
      expect(document.window.document.title).toBe("Assets");
      for (const element of document.window.document.querySelectorAll("img")) {
        const src = element.getAttribute("src")!;
        const url = new URL(src, pathToFileURL(path.join(output, "index.html")));
        expect(url.searchParams.get("size")).toBe("large");
        expect(url.searchParams.has("__window")).toBe(false);
        expect(url.hash).toBe("#symbol");
        expect(await fs.readFile(fileURLToPath(url), "utf8")).toBe(image("quoted"));
      }
    } finally {
      document.window.close();
    }
  });

  it("decodes relative HTML URLs and keeps files with the same basename distinct", async () => {
    await Promise.all([fs.mkdir(path.join(workspace, "one")), fs.mkdir(path.join(workspace, "two"))]);
    await Promise.all([
      fs.writeFile(path.join(workspace, "one", "a&b.svg"), image("one")),
      fs.writeFile(path.join(workspace, "two", "a&b.svg"), image("two"))
    ]);
    const html = "<img src=\"./one/a%26b.svg\"><img src='./two/a%26b.svg'>";
    const assetsDir = path.join(output, "assets");
    await fs.mkdir(assetsDir);
    const packaged = await collectAndCopyAssets(html, notePath, assetsDir, "assets", workspace);
    expect(packaged.copiedFiles).toHaveLength(2);
    expect(new Set(packaged.copiedFiles).size).toBe(2);
    const document = readHtml(packaged.processedHtml);
    try {
      const contents = await Promise.all(
        [...document.window.document.querySelectorAll("img")].map((element) => {
          const url = new URL(element.getAttribute("src")!, pathToFileURL(path.join(output, "index.html")));
          return fs.readFile(fileURLToPath(url), "utf8");
        })
      );
      expect(contents).toEqual([image("one"), image("two")]);
    } finally {
      document.window.close();
    }
  });

  it("keeps case-insensitive output names distinct so each packaged URL retains its own contents", async () => {
    await Promise.all([fs.mkdir(path.join(workspace, "one")), fs.mkdir(path.join(workspace, "two"))]);
    await Promise.all([
      fs.writeFile(path.join(workspace, "one", "A.svg"), image("uppercase")),
      fs.writeFile(path.join(workspace, "two", "a.svg"), image("lowercase"))
    ]);
    const { markdownToHTML } = await import("../../apps/desktop/src/renderer/src/lib/markdown-processor");
    const html = await markdownToHTML("![first](./one/A.svg)\n\n![second](./two/a.svg)", {
      notePath,
      enableCopyButton: false
    });
    const assetsDir = path.join(output, "assets");
    await fs.mkdir(assetsDir);
    const packaged = await collectAndCopyAssets(html, notePath, assetsDir, "assets", workspace);
    expect(packaged.copiedFiles).toHaveLength(2);
    expect(new Set(packaged.copiedFiles.map((file) => path.basename(file).normalize("NFC").toLowerCase())).size).toBe(
      2
    );
    const document = readHtml(packaged.processedHtml);
    try {
      const contents = await Promise.all(
        [...document.window.document.querySelectorAll("img")].map((element) => {
          const url = new URL(element.getAttribute("src")!, pathToFileURL(path.join(output, "index.html")));
          return fs.readFile(fileURLToPath(url), "utf8");
        })
      );
      expect(contents).toEqual([image("uppercase"), image("lowercase")]);
    } finally {
      document.window.close();
    }
  });

  it("does not read or package HTML-escaped paths outside the workspace", async () => {
    const outside = path.join(root, "outside&private.svg");
    await fs.writeFile(outside, image("private"));
    const src = pathToFileURL(outside).href.replaceAll("&", "&amp;");
    const html = `<img src="${src}">`;
    expect(await embedLocalImages(html, notePath, workspace)).not.toContain("data:image");
    const assetsDir = path.join(output, "assets");
    await fs.mkdir(assetsDir);
    expect((await collectAndCopyAssets(html, notePath, assetsDir, "assets", workspace)).copiedFiles).toEqual([]);
    expect(await fs.readdir(assetsDir)).toEqual([]);
  });
});
