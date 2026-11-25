import fsSync from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectAndCopyAssets,
  embedLocalImages,
  inspectExportAssets,
  renderHtmlExportPreview
} from "../../apps/desktop/src/main/export/assets";
import { downloadExportImage } from "../../apps/desktop/src/main/export/remote-images";

type Request = { url: string; resourceType: string; webContentsId: number };
type Guard = (request: Request, callback: (result: { cancel: boolean }) => void) => void;
const { captureState, remoteFetch } = vi.hoisted(() => ({
  remoteFetch: vi.fn(),
  captureState: {
    guard: undefined as Guard | undefined,
    documentUrl: "",
    contentsId: 0,
    loadedHtml: "",
    documentHeight: 80,
    captureHeight: 0,
    loadError: undefined as Error | undefined,
    destroyCount: 0,
    brokenImages: [] as string[],
    decodedImages: [] as (boolean | Promise<boolean>)[],
    decodeCount: 0,
    imageRequestDecisions: [] as boolean[],
    imageFile: "",
    decisions: [] as boolean[]
  }
}));
vi.mock("../../apps/desktop/src/main/security/remote-url", () => ({ fetchSafeRemoteHttp: remoteFetch }));
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const { readFile } = await import("node:fs/promises");
  class Contents extends EventEmitter {
    id = 73;
    setWindowOpenHandler() {}
    async executeJavaScript(script: string) {
      if (script.startsWith("Array.from(document.images)")) return captureState.brokenImages;
      if (script.startsWith("(async () => {") && script.includes("const image = new Image()")) {
        const file = captureState.imageFile;
        if (file) {
          const requests = [
            { url: file, resourceType: "image", webContentsId: this.id },
            { url: file, resourceType: "image", webContentsId: 999 },
            { url: file, resourceType: "xhr", webContentsId: this.id },
            { url: "file:///outside/other.png", resourceType: "image", webContentsId: this.id }
          ];
          captureState.imageRequestDecisions = requests.map((request) => {
            let cancel = false;
            captureState.guard!(request, (result) => {
              cancel = result.cancel;
            });
            return cancel;
          });
        }
        return captureState.decodedImages[captureState.decodeCount++] ?? false;
      }
      return script.startsWith("Math.max") ? captureState.documentHeight : true;
    }
    async capturePage() {
      return { captured: true };
    }
  }
  return {
    session: {
      fromPartition: () => ({
        webRequest: {
          onBeforeRequest: (_filter: unknown, callback: Guard) => {
            captureState.guard = callback;
          }
        }
      })
    },
    BrowserWindow: class extends EventEmitter {
      webContents = new Contents();
      constructor(private options: Electron.BrowserWindowConstructorOptions) {
        super();
      }
      async loadURL(url: string) {
        if (url === "about:blank") return;
        captureState.documentUrl = url;
        captureState.contentsId = this.webContents.id;
        if (captureState.loadError) throw captureState.loadError;
        captureState.loadedHtml = await readFile(new URL(url), "utf8");
        const requests = [
          { url: captureState.documentUrl, resourceType: "mainFrame", webContentsId: this.webContents.id },
          { url: captureState.documentUrl, resourceType: "mainFrame", webContentsId: 999 },
          { url: captureState.documentUrl, resourceType: "xhr", webContentsId: this.webContents.id },
          { url: "file:///outside/private.svg", resourceType: "image", webContentsId: this.webContents.id },
          { url: "https://example.com/private.svg", resourceType: "image", webContentsId: this.webContents.id },
          { url: "data:image/png;base64,aW1hZ2U=", resourceType: "image", webContentsId: this.webContents.id }
        ];
        captureState.decisions = requests.map((request) => {
          let cancel = false;
          captureState.guard!(request, (result) => {
            cancel = result.cancel;
          });
          return cancel;
        });
        this.webContents.emit("dom-ready");
      }
      setContentSize(_width: number, height: number) {
        captureState.captureHeight = this.options.enableLargerThanScreen ? height : Math.min(height, 600);
        queueMicrotask(() => this.emit("resize"));
      }
      isDestroyed() {
        return false;
      }
      destroy() {
        captureState.destroyCount++;
      }
    }
  };
});

import { captureHtmlAsImage, validateExportImages } from "../../apps/desktop/src/main/export/capture";

let root: string;
let workspace: string;
let inside: string;
let outside: string;
const imageContents =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>';

beforeEach(async () => {
  captureState.loadError = undefined;
  captureState.destroyCount = 0;
  captureState.documentHeight = 80;
  captureState.captureHeight = 0;
  captureState.brokenImages = [];
  captureState.decodedImages = [];
  captureState.decodeCount = 0;
  captureState.imageRequestDecisions = [];
  captureState.imageFile = "";
  remoteFetch.mockReset();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-boundary-"));
  workspace = path.join(root, "workspace");
  await fs.mkdir(workspace);
  inside = path.join(workspace, "inside & image.svg");
  outside = path.join(root, "outside.svg");
  await Promise.all([fs.writeFile(inside, imageContents), fs.writeFile(outside, imageContents)]);
});
afterEach(async () => fs.rm(root, { recursive: true, force: true }));

describe("export local CSS resources", () => {
  it("embeds authorized CSS images from attributes and style blocks, including escaped names and SVG fragments", async () => {
    const uri = pathToFileURL(inside).href.replaceAll("&", "&amp;");
    const absolutePath = pathToFileURL(inside).pathname;
    const html = `<html><head><style>.image{background-image:url('./inside%20%26%20image.svg#symbol')}.absolute{background-image:url('${absolutePath}#symbol')}</style></head><body><div style='background-image:url("${uri}")'></div></body></html>`;
    const embedded = await embedLocalImages(html, path.join(workspace, "note.md"), workspace);
    expect(embedded.match(/data:image\/svg\+xml;base64,/g)).toHaveLength(3);
    expect(embedded.match(/#symbol/g)).toHaveLength(2);
    expect(embedded).not.toContain("file:");
  });

  it("keeps CSS URLs on the approved UNC workspace local throughout preview, capture and HTML packaging", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
    const workspacePath = await fs.realpath(workspace);
    const paper = await fs.realpath(inside);
    const scannedWorkspacePath = "//files.example.invalid/share/My Notes";
    const alias = `${scannedWorkspacePath}/paper.svg`;
    const missingAlias = `${scannedWorkspacePath}/missing.svg`;
    const localUrl = "//files.example.invalid/share/My%20Notes/paper.svg?size=large#detail";
    const missingUrl = "//files.example.invalid/share/My%20Notes/missing.svg";
    const webUrl = "//files.example.invalid/share/My%20Notes-other/web.svg";
    const html = `<div style="background:url('${localUrl}')"></div><div style="background:url('${missingUrl}')"></div><div style="background:url('${webUrl}')"></div>`;
    const scope = { workspacePath, scannedWorkspacePath };
    const notePath = path.join(workspacePath, "note.md");
    const realpath = fsSync.realpathSync.native;
    const lstat = fsSync.lstatSync;
    const realAliases = new Map([
      [path.resolve(scannedWorkspacePath), workspacePath],
      [path.resolve(alias), paper]
    ]);
    const realpathMock = vi.spyOn(fsSync.realpathSync, "native").mockImplementation((target) => {
      return realpath(realAliases.get(String(target)) ?? target);
    });
    const lstatMock = vi.spyOn(fsSync, "lstatSync").mockImplementation((target) => {
      if (target === path.resolve(missingAlias))
        throw Object.assign(new Error("Missing test file"), { code: "ENOENT" });
      return lstat(realAliases.get(String(target)) ?? target);
    });
    Object.defineProperty(process, "platform", { ...platform, value: "win32" });
    try {
      remoteFetch.mockImplementation(async () => ({
        response: new Response(imageContents, { headers: { "content-type": "image/svg+xml" } })
      }));
      const assets = await inspectExportAssets([html], notePath, scope, "capture", async (sources) =>
        sources.map(() => true)
      );
      expect(assets.missing).toEqual([{ name: missingAlias, reason: "local" }]);
      expect(remoteFetch).toHaveBeenCalledExactlyOnceWith(`https:${webUrl}`, expect.anything(), { httpsOnly: true });
      await captureHtmlAsImage(html, notePath, 80, scope, { assets, includeExternal: false, missingLabel: "Omitted" });
      expect(captureState.loadedHtml).toContain(
        `data:image/svg+xml;base64,${Buffer.from(imageContents).toString("base64")}#detail`
      );

      const preview = await renderHtmlExportPreview(html, assets, "Omitted", "preview-window");
      expect(preview).toContain("local-resource://file/");
      expect(preview).toContain("#detail");
      expect(preview).toContain(`https:${webUrl}`);
      expect(preview).not.toContain("missing.svg");

      const assetsDir = path.join(root, "assets");
      await fs.mkdir(assetsDir);
      const packaged = await collectAndCopyAssets(html, notePath, assetsDir, "assets", scope);
      expect(packaged.copiedFiles).toHaveLength(1);
      expect(await fs.readFile(packaged.copiedFiles[0], "utf8")).toBe(imageContents);
      expect(packaged.processedHtml).toContain("?size=large#detail");
      expect(packaged.processedHtml).toContain(`https:${webUrl}`);
    } finally {
      Object.defineProperty(process, "platform", platform);
      realpathMock.mockRestore();
      lstatMock.mockRestore();
    }
  });

  it("does not embed resources outside the workspace, including symlink escapes", async () => {
    const linked = path.join(workspace, "linked.svg");
    await fs.symlink(outside, linked);
    const html = `<div style='background:url("${pathToFileURL(outside).href}")'></div><div style='background:url("${pathToFileURL(linked).href}")'></div>`;
    expect(await embedLocalImages(html, path.join(workspace, "note.md"), workspace)).not.toContain("data:image");
  });

  it("allows only the owning capture's main document and embedded resources, then revokes the document", async () => {
    const html = `<img src="./inside & image.svg"><div style='background:url("${pathToFileURL(outside).href}")'></div>`;
    await captureHtmlAsImage(html, path.join(workspace, "note.md"), 80, workspace);
    expect(captureState.loadedHtml).toContain("data:image/svg+xml;base64,");
    expect(captureState.decisions).toEqual([false, true, true, true, true, false]);
    let cancel = false;
    captureState.guard!(
      { url: captureState.documentUrl, resourceType: "mainFrame", webContentsId: captureState.contentsId },
      (result) => {
        cancel = result.cancel;
      }
    );
    expect(cancel).toBe(true);
    expect(captureState.destroyCount).toBe(1);
    await expect(fs.access(new URL(captureState.documentUrl))).rejects.toThrow();
  });

  it("propagates a navigation failure immediately and cleans up before allowing a retry", async () => {
    captureState.loadError = new Error("injected load failure");
    await expect(captureHtmlAsImage("<p>Export</p>")).rejects.toThrow("injected load failure");
    expect(captureState.destroyCount).toBe(1);
    await expect(fs.access(new URL(captureState.documentUrl))).rejects.toThrow();
    captureState.loadError = undefined;
    await expect(captureHtmlAsImage("<p>Retry</p>")).resolves.toEqual({ captured: true });
    expect(captureState.destroyCount).toBe(2);
  });

  it("captures the whole document when it is taller than the screen", async () => {
    captureState.documentHeight = 900;

    await expect(captureHtmlAsImage("<p>Tall export</p>")).resolves.toEqual({ captured: true });

    expect(captureState.captureHeight).toBe(900);
  });

  it("loads the authorized document URL when the temporary directory contains brackets", async () => {
    const temporary = path.join(root, "temp [test]");
    await fs.mkdir(temporary);
    vi.stubEnv(process.platform === "win32" ? "TEMP" : "TMPDIR", temporary);
    try {
      await expect(captureHtmlAsImage("<p>Tall export</p>")).resolves.toEqual({ captured: true });
      expect(captureState.documentUrl).toContain("%5Btest%5D");
      expect(captureState.decisions[0]).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

it("prepares HTTPS images once and reports corrupt downloads before capture", async () => {
  remoteFetch.mockImplementation(async (url: string) => ({
    response: url.endsWith(".svg")
      ? new Response(new Uint8Array(gzipSync(imageContents)), {
          headers: { "content-type": "image/svg+xml", "content-encoding": "gzip" }
        })
      : new Response("not an image", {
          headers: { "content-type": url.endsWith("corrupt.png") ? "image/png" : "text/html" }
        })
  }));
  captureState.decodedImages = [true, false];
  const html =
    '<img alt="Chart" src="https://example.com/chart.svg#detail"><img alt="HTTP" src="http://example.com/chart.png"><img alt="Failure" src="https://example.com/failure.png"><img alt="Corrupt" src="https://example.com/corrupt.png">';
  const assets = await inspectExportAssets(
    [html, html],
    path.join(workspace, "note.md"),
    workspace,
    "capture",
    validateExportImages
  );

  expect(remoteFetch).toHaveBeenCalledTimes(3);
  expect(remoteFetch).toHaveBeenCalledWith("https://example.com/chart.svg", expect.anything(), { httpsOnly: true });
  expect(assets.missing).toEqual([
    { name: "example.com/chart.png", reason: "http" },
    { name: "example.com/failure.png", reason: "download" },
    { name: "example.com/corrupt.png", reason: "decode" }
  ]);

  await captureHtmlAsImage(html, undefined, 800, workspace, {
    assets,
    includeExternal: false,
    missingLabel: "Omitted"
  });
  expect(captureState.loadedHtml).toContain(
    `data:image/svg+xml;base64,${Buffer.from(imageContents).toString("base64")}#detail`
  );
  expect(captureState.loadedHtml).toContain("HTTP (Omitted)");
  expect(captureState.loadedHtml).toContain("Failure (Omitted)");
  expect(captureState.loadedHtml).toContain("Corrupt (Omitted)");
  expect(captureState.loadedHtml).not.toContain("https://example.com/");
});

it.each([
  ["deflate", () => deflateSync(imageContents)],
  ["br", () => brotliCompressSync(imageContents)],
  ["gzip, br", () => brotliCompressSync(gzipSync(imageContents))]
] as const)("decodes the %s content encoding before embedding", async (encoding, compress) => {
  remoteFetch.mockResolvedValue({
    response: new Response(new Uint8Array(compress()), {
      headers: { "content-type": "image/svg+xml", "content-encoding": encoding }
    })
  });

  await expect(downloadExportImage("https://example.com/chart.svg", new AbortController().signal)).resolves.toBe(
    `data:image/svg+xml;base64,${Buffer.from(imageContents).toString("base64")}`
  );
});

it("cancels the download when the decoded bytes exceed the image limit", async () => {
  const compressed = new Uint8Array(gzipSync(Buffer.alloc(10 * 1024 * 1024 + 1, 32)));
  const cancel = vi.fn();
  const body = new ReadableStream({ start: (controller) => controller.enqueue(compressed), cancel });
  remoteFetch.mockResolvedValue({
    response: new Response(body, {
      headers: {
        "content-type": "image/svg+xml",
        "content-encoding": "gzip",
        "content-length": String(compressed.length)
      }
    })
  });

  await expect(downloadExportImage("https://example.com/large.svg", new AbortController().signal)).resolves.toBeNull();
  expect(cancel).toHaveBeenCalledOnce();
});

it("fails the capture before saving when Chromium cannot decode a reviewed image", async () => {
  captureState.brokenImages = ["Chart"];
  await expect(captureHtmlAsImage('<img src="data:image/png;base64,AAAA" alt="Chart">')).rejects.toThrow("Chart");
});

it("keeps completed decodes and processes later images while one decode stalls", async () => {
  captureState.decodedImages = [new Promise<boolean>(() => {}), true, false, true, true];
  const sources = Array.from({ length: 5 }, (_, index) => `data:image/png;base64,fixture-${index}`);
  vi.useFakeTimers();
  try {
    const pending = validateExportImages(sources);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await pending).toEqual([false, true, false, true, true]);
    expect(captureState.destroyCount).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

it("rejects a replacement file before embedding a reviewed external image", async () => {
  const html = '<img src="../outside.svg">';
  const note = path.join(workspace, "note.md");
  const assets = await inspectExportAssets([html], note, workspace, "capture", async (sources) =>
    sources.map(() => true)
  );
  expect(assets.externalFiles).toEqual([await fs.realpath(outside)]);
  await fs.rename(outside, path.join(root, "reviewed.svg"));
  await fs.writeFile(outside, imageContents.replace("blue", "red"));

  await expect(
    captureHtmlAsImage(html, note, 80, workspace, { assets, includeExternal: true, missingLabel: "Omitted" })
  ).rejects.toThrow("Export asset changed: outside.svg");
  expect(captureState.destroyCount).toBe(0);
});

it("rejects an in-place edit during a reviewed read and closes the checked handle", async () => {
  const html = '<img src="../outside.svg">';
  const note = path.join(workspace, "note.md");
  const sourcePath = await fs.realpath(outside);
  const assets = await inspectExportAssets([html], note, workspace, "capture", async (sources) =>
    sources.map(() => true)
  );
  const open = fs.open;
  let sourceHandle: FileHandle | undefined;
  const openMock = vi.spyOn(fs, "open").mockImplementation(async (filePath, ...options) => {
    const file = await open(filePath, ...options);
    if (filePath === sourcePath) {
      sourceHandle = file;
      const readFile = file.readFile.bind(file);
      vi.spyOn(file, "readFile").mockImplementationOnce(async () => {
        await fs.writeFile(sourcePath, imageContents.replace("blue", "orange"));
        return readFile();
      });
    }
    return file;
  });

  try {
    await expect(
      captureHtmlAsImage(html, note, 80, workspace, { assets, includeExternal: true, missingLabel: "Omitted" })
    ).rejects.toThrow("Export asset changed: outside.svg");
    expect(sourceHandle?.fd).toBe(-1);
    expect(captureState.destroyCount).toBe(0);
  } finally {
    openMock.mockRestore();
  }
});

it("omits undecodable local images before capture and scopes decoder file requests to the reviewed images", async () => {
  const broken = path.join(workspace, "truncated.png");
  await fs.writeFile(broken, Buffer.from([137, 80, 78, 71]));
  captureState.decodedImages = [true, false];
  captureState.imageFile = pathToFileURL(await fs.realpath(inside)).href;
  const html = '<img alt="Valid" src="./inside & image.svg"><img alt="Truncated" src="./truncated.png">';
  const note = path.join(workspace, "note.md");
  const assets = await inspectExportAssets([html], note, workspace, "capture", validateExportImages);

  expect(captureState.imageRequestDecisions).toEqual([false, true, true, true]);
  expect(assets.missing).toEqual([{ name: await fs.realpath(broken), reason: "decode" }]);
  await captureHtmlAsImage(html, note, 80, workspace, { assets, includeExternal: false, missingLabel: "Omitted" });
  expect(captureState.loadedHtml).toContain("Truncated (Omitted)");
  expect(captureState.loadedHtml).toContain("data:image/svg+xml;base64,");
  expect(captureState.loadedHtml).not.toContain("truncated.png");
});
