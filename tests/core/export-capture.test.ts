import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embedLocalCssImages } from "../../apps/desktop/src/main/export/css-assets";

type Request = { url: string; resourceType: string; webContentsId: number };
type Guard = (request: Request, callback: (result: { cancel: boolean }) => void) => void;
const { captureState } = vi.hoisted(() => ({
  captureState: {
    guard: undefined as Guard | undefined,
    documentUrl: "",
    contentsId: 0,
    loadedHtml: "",
    documentHeight: 80,
    captureHeight: 0,
    loadError: undefined as Error | undefined,
    destroyCount: 0,
    decisions: [] as boolean[]
  }
}));
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const { readFile } = await import("node:fs/promises");
  class Contents extends EventEmitter {
    id = 73;
    setWindowOpenHandler() {}
    async executeJavaScript(script: string) {
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

import { captureHtmlAsImage } from "../../apps/desktop/src/main/export/capture";

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
    const embedded = await embedLocalCssImages(html, path.join(workspace, "note.md"), workspace);
    expect(embedded.match(/data:image\/svg\+xml;base64,/g)).toHaveLength(3);
    expect(embedded.match(/#symbol/g)).toHaveLength(2);
    expect(embedded).not.toContain("file:");
  });

  it("does not embed resources outside the workspace, including symlink escapes", async () => {
    const linked = path.join(workspace, "linked.svg");
    await fs.symlink(outside, linked);
    const html = `<div style='background:url("${pathToFileURL(outside).href}")'></div><div style='background:url("${pathToFileURL(linked).href}")'></div>`;
    expect(await embedLocalCssImages(html, path.join(workspace, "note.md"), workspace)).not.toContain("data:image");
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
