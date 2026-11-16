import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorizeLocalResourceUrl, createUrlTransformer, decodeLocalResourceUrl } from "@shared";
import { resolveAuthorizedLocalResource } from "../../apps/desktop/src/main/security/local-resource";
import { collectAndCopyAssets, embedLocalImages } from "../../apps/desktop/src/main/export/assets";

describe("window-bound local resources", () => {
  let root: string;
  let workspaceA: string;
  let workspaceB: string;
  let imageA: string;
  let imageB: string;
  let workspaces: Map<string, string>;
  const workspaceForToken = (token: string) => workspaces.get(token) ?? null;
  const resourceUrl = (file: string, token: string) =>
    authorizeLocalResourceUrl(createUrlTransformer(undefined)(file), token);

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-resources-"));
    workspaceA = path.join(root, "a");
    workspaceB = path.join(root, "b");
    await Promise.all([fs.mkdir(workspaceA), fs.mkdir(workspaceB)]);
    imageA = path.join(workspaceA, process.platform === "win32" ? "图片 #1 %.png" : "图片 #1? %.png");
    imageB = path.join(workspaceB, "private.png");
    await Promise.all([fs.writeFile(imageA, "image-a"), fs.writeFile(imageB, "image-b")]);
    // realpath handles /tmp -> /private/tmp on macOS, matching actual window binding.
    workspaceA = await fs.realpath(workspaceA);
    workspaceB = await fs.realpath(workspaceB);
    imageA = path.join(workspaceA, path.basename(imageA));
    imageB = path.join(workspaceB, path.basename(imageB));
    workspaces = new Map([
      ["window-a", workspaceA],
      ["window-b", workspaceB]
    ]);
  });

  afterEach(async () => fs.rm(root, { recursive: true, force: true }));

  it("loads its own resources without a focused window, and rejects another workspace", () => {
    expect(resolveAuthorizedLocalResource(resourceUrl(imageA, "window-a"), workspaceForToken)).toBe(imageA);
    expect(resolveAuthorizedLocalResource(resourceUrl(imageB, "window-a"), workspaceForToken)).toBeNull();
    expect(resolveAuthorizedLocalResource(resourceUrl(imageB, "window-b"), workspaceForToken)).toBe(imageB);
  });

  it("requires a valid window token and rejects directories and escaped symlinks", async () => {
    expect(resolveAuthorizedLocalResource(createUrlTransformer(undefined)(imageA), workspaceForToken)).toBeNull();
    expect(resolveAuthorizedLocalResource(resourceUrl(imageA, "unknown"), workspaceForToken)).toBeNull();
    expect(resolveAuthorizedLocalResource(resourceUrl(workspaceA, "window-a"), workspaceForToken)).toBeNull();
    const link = path.join(workspaceA, "outside.png");
    await fs.symlink(imageB, link);
    expect(resolveAuthorizedLocalResource(resourceUrl(link, "window-a"), workspaceForToken)).toBeNull();
  });

  it("invalidates a closed window and follows the owning window's current workspace", () => {
    const oldUrl = resourceUrl(imageA, "window-a");
    workspaces.set("window-a", workspaceB);
    expect(resolveAuthorizedLocalResource(oldUrl, workspaceForToken)).toBeNull();
    expect(resolveAuthorizedLocalResource(resourceUrl(imageB, "window-a"), workspaceForToken)).toBe(imageB);
    workspaces.delete("window-a");
    expect(resolveAuthorizedLocalResource(resourceUrl(imageB, "window-a"), workspaceForToken)).toBeNull();
  });

  it("keeps signed image URLs compatible with embedded and packaged exports", async () => {
    const url = resourceUrl(imageA, "window-a");
    expect(decodeLocalResourceUrl(url)).toBe(imageA);
    const html = `<img src="${url}">`;
    const notePath = path.join(workspaceA, "note.md");
    expect(await embedLocalImages(html, notePath, workspaceA)).toContain("data:image/png;base64,aW1hZ2UtYQ==");
    const assetsFolder = "assets # %";
    const assetsDir = path.join(root, assetsFolder);
    await fs.mkdir(assetsDir);
    const packaged = await collectAndCopyAssets(html, notePath, assetsDir, assetsFolder, workspaceA);
    expect(packaged.copiedFiles).toHaveLength(1);
    expect(await fs.readFile(packaged.copiedFiles[0], "utf8")).toBe("image-a");
    expect(packaged.processedHtml).not.toContain("__window");
    const packagedSrc = /src="([^"]+)"/.exec(packaged.processedHtml)![1];
    const packagedUrl = new URL(packagedSrc, pathToFileURL(path.join(root, "index.html")));
    expect(packagedUrl.search).toBe("");
    expect(packagedUrl.hash).toBe("");
    expect(await fs.readFile(fileURLToPath(packagedUrl), "utf8")).toBe("image-a");

    const svgPath = path.join(workspaceA, "icons.svg");
    await fs.writeFile(svgPath, "<svg></svg>");
    const svgHtml = `<img src="${resourceUrl(svgPath, "window-a")}#symbol">`;
    const svgPackage = await collectAndCopyAssets(svgHtml, notePath, assetsDir, assetsFolder, workspaceA);
    const svgUrl = new URL(
      /src="([^"]+)"/.exec(svgPackage.processedHtml)![1],
      pathToFileURL(path.join(root, "index.html"))
    );
    expect(svgUrl.hash).toBe("#symbol");
    expect(await fs.readFile(fileURLToPath(svgUrl), "utf8")).toBe("<svg></svg>");
  });
});

describe("local resource URL compatibility", () => {
  it("preserves fragments and non-capability query parameters while replacing foreign tokens", () => {
    const signed = authorizeLocalResourceUrl(
      "local-resource:///workspace/icons.svg?size=large&__window=foreign#symbol-1",
      "own-window"
    );
    const parsed = new URL(signed);
    expect(parsed.searchParams.get("size")).toBe("large");
    expect(parsed.searchParams.getAll("__window")).toEqual(["own-window"]);
    expect(parsed.hash).toBe("#symbol-1");
    expect(decodeLocalResourceUrl(signed)).toBe("/workspace/icons.svg");
  });

  it.each([
    ["local-resource:///Users/name/photo%20one.png", "/Users/name/photo one.png"],
    ["local-resource://localhost/Users/name/photo.png", "/Users/name/photo.png"],
    ["local-resource://C:/Users/name/photo.png", "C:/Users/name/photo.png"],
    ["local-resource:///C:/Users/name/photo.png", "C:/Users/name/photo.png"]
  ])("decodes legacy and signed paths: %s", (legacy, expected) => {
    expect(decodeLocalResourceUrl(legacy)).toBe(expected);
    const signed = authorizeLocalResourceUrl(legacy, "own-window");
    expect(decodeLocalResourceUrl(signed)).toBe(expected);
    expect(new URL(signed).searchParams.get("__window")).toBe("own-window");
  });
});
