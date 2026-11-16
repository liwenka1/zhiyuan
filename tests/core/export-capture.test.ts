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
    decisions: [] as boolean[]
  }
}));
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const { readFile } = await import("node:fs/promises");
  const { pathToFileURL } = await import("node:url");
  class Contents extends EventEmitter {
    id = 73;
    setWindowOpenHandler() {}
    async executeJavaScript(script: string) {
      return script.startsWith("Math.max") ? 80 : true;
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
      async loadFile(file: string) {
        captureState.documentUrl = pathToFileURL(file).href;
        captureState.contentsId = this.webContents.id;
        captureState.loadedHtml = await readFile(file, "utf8");
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
      setContentSize() {
        queueMicrotask(() => this.emit("resize"));
      }
      isDestroyed() {
        return false;
      }
      close() {}
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
    await expect(fs.access(new URL(captureState.documentUrl))).rejects.toThrow();
  });
});
