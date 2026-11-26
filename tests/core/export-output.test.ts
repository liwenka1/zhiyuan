import fs, { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";
import type { ClipboardEquationSource } from "../../apps/desktop/src/main/export/clipboard-equation-layout";
import type { ClipboardWatch } from "../../apps/desktop/src/main/export/clipboard-state";

type Handler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<IpcResultDTO<unknown>>;
type Listener = (event: Electron.IpcMainEvent) => void;
const {
  handlers,
  listeners,
  capture,
  captureEquations,
  saveDialog,
  reviewDialog,
  writeClipboard,
  writeHTML,
  writeText,
  validateImages,
  downloadImage,
  callerWindow,
  checkClipboard,
  watchClipboard,
  systemClipboard,
  current
} = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  listeners: new Map<string, Listener>(),
  capture: vi.fn(),
  captureEquations:
    vi.fn<
      (
        sources: ClipboardEquationSource[],
        assertCurrent: () => void,
        signal: AbortSignal
      ) => Promise<Map<ClipboardEquationSource, { url: string; width: number; height: number }>>
    >(),
  saveDialog: vi.fn(),
  reviewDialog: vi.fn(),
  writeClipboard: vi.fn<(data: Electron.Data) => void>(),
  writeHTML: vi.fn<(html: string) => void>(),
  writeText: vi.fn<(text: string) => void>(),
  validateImages: vi.fn<(images: string[], signal?: AbortSignal) => Promise<boolean[]>>(),
  downloadImage: vi.fn<(url: string, signal: AbortSignal) => Promise<string | null>>(),
  callerWindow: vi.fn(),
  checkClipboard: vi.fn<(unchanged: boolean) => boolean | Promise<boolean>>(),
  watchClipboard: vi.fn<() => Promise<ClipboardWatch>>(),
  systemClipboard: { text: "", html: "", needsConfirmation: false, needsWindowFocus: false },
  current: { workspace: "/test-workspace", workspaceRevision: 0 }
}));
vi.mock("../../apps/desktop/src/main/security/app-ipc", () => ({
  handleAppIpc: (channel: string, handler: Handler) => handlers.set(channel, handler),
  onAppIpc: (channel: string, listener: Listener) => listeners.set(channel, listener)
}));
vi.mock("../../apps/desktop/src/main/security/window-context", () => ({
  getCallerWorkspace: () => current.workspace,
  getCallerWorkspaceScope: () => ({
    workspacePath: current.workspace,
    workspaceRevision: current.workspaceRevision
  }),
  getCallerResourceToken: () => "window-token"
}));
vi.mock("../../apps/desktop/src/main/export/capture", () => ({
  captureHtmlAsImage: capture,
  captureClipboardEquations: captureEquations,
  validateExportImages: validateImages
}));
vi.mock("../../apps/desktop/src/main/export/clipboard-state", () => ({
  initializeClipboardMonitor: () => {},
  watchClipboard
}));
vi.mock("../../apps/desktop/src/main/export/remote-images", () => ({ downloadExportImage: downloadImage }));
vi.mock("../../apps/desktop/src/main/native/koffi", () => ({
  loadPackagedKoffi: () => undefined,
  requireNative: () => {
    throw new Error("No native clipboard counter in this fixture");
  }
}));
vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: callerWindow },
  dialog: { showSaveDialog: saveDialog, showMessageBox: reviewDialog },
  app: { getLocale: () => "en" },
  clipboard: {
    write: writeClipboard,
    writeHTML,
    writeText
  }
}));

import { registerExportHandlers } from "../../apps/desktop/src/main/export/handlers";
import { embedExportAssets, inspectExportAssets } from "../../apps/desktop/src/main/export/assets";
import * as exclusiveRename from "../../apps/desktop/src/main/file-system/exclusive-rename";
import {
  inspectExportDestination,
  writeExportDirectory,
  writeExportFile
} from "../../apps/desktop/src/main/export/output";

beforeAll(registerExportHandlers);

describe("export output", () => {
  let root: string;
  let window: EventEmitter & { focused: boolean; destroyed: boolean };
  const sendToRenderer = vi.fn();
  const event = {
    senderFrame: { isDestroyed: () => false, detached: false, send: sendToRenderer }
  } as unknown as Electron.IpcMainInvokeEvent;

  function invokeFrom(caller: Electron.IpcMainInvokeEvent, channel: string, ...args: unknown[]) {
    return handlers.get(`export:${channel}`)!(caller, ...args);
  }

  function invoke(channel: string, ...args: unknown[]) {
    return invokeFrom(event, channel, ...args);
  }

  async function beginCopy(notePath: string, caller = event) {
    const result = await invokeFrom(caller, "begin-clipboard-copy", current.workspace, notePath);
    if (!result.ok) throw new Error(result.error.message);
    expect(typeof result.value).toBe("number");
    return result.value;
  }

  async function copyFullText(markdown: string, html: string, notePath: string, language: "zh" | "en") {
    return invoke("copy-full-text", await beginCopy(notePath), markdown, html, language);
  }

  async function select(outputPath: string, language?: "en" | "zh") {
    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: outputPath });
    await expect(invoke("show-save-dialog", { defaultPath: outputPath, language })).resolves.toEqual({
      ok: true,
      value: outputPath
    });
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-export-output-"));
    current.workspace = path.join(root, "workspace");
    current.workspaceRevision = 0;
    capture.mockReset();
    captureEquations.mockReset();
    reviewDialog.mockReset();
    writeClipboard.mockReset();
    writeHTML.mockReset();
    writeText.mockReset();
    sendToRenderer.mockReset();
    systemClipboard.text = "";
    systemClipboard.html = "";
    systemClipboard.needsConfirmation = false;
    systemClipboard.needsWindowFocus = false;
    checkClipboard.mockReset().mockImplementation((unchanged) => unchanged);
    watchClipboard.mockReset().mockImplementation(async () => {
      const { text, html, needsConfirmation, needsWindowFocus } = systemClipboard;
      return {
        needsConfirmation,
        needsWindowFocus,
        unchanged: () => checkClipboard(text === systemClipboard.text && html === systemClipboard.html)
      };
    });
    window = Object.assign(new EventEmitter(), { focused: true, destroyed: false });
    callerWindow.mockReset().mockReturnValue(
      Object.assign(window, {
        isFocused: () => window.focused,
        isDestroyed: () => window.destroyed
      })
    );
    validateImages.mockReset().mockImplementation(async (sources) => sources.map(() => true));
    downloadImage.mockReset().mockResolvedValue(null);
    capture.mockImplementation(async (html: string) => ({ toPNG: () => Buffer.from(html) }));
  });
  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("writes the full Markdown and HTML with embedded images and downloadable files together", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const figure = '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>';
    await writeFile(path.join(current.workspace, "figure.svg"), figure);
    await writeFile(path.join(current.workspace, "sample.pdf"), "PDF attachment fixture");
    const markdown = "---\ntitle: Note\n---\n\n# Current draft\n\n![Figure](figure.svg)\n\n[Sample](sample.pdf)\n";
    const html = '<h1>Current draft</h1><img alt="Figure" src="figure.svg"><a href="sample.pdf">Sample</a>';

    expect(await copyFullText(markdown, html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({
      text: markdown,
      html: expect.stringContaining(`data:image/svg+xml;base64,${Buffer.from(figure).toString("base64")}`)
    });
    const copied = writeClipboard.mock.calls[0][0];
    expect(copied.html).toContain(
      `href="data:application/octet-stream;base64,${Buffer.from("PDF attachment fixture").toString("base64")}" download="sample.pdf"`
    );
    expect(copied.html).toContain("<h1>Current draft</h1>");
    expect(validateImages).toHaveBeenCalledExactlyOnceWith(
      [expect.stringContaining("figure.svg")],
      expect.any(AbortSignal)
    );
    expect(reviewDialog).not.toHaveBeenCalled();
  });

  it("puts a single rendered version of each formula in rich text while retaining Markdown source", async () => {
    await mkdir(current.workspace);
    const tex = String.raw`\frac{a}{b}`;
    const visual = '<span class="katex-html" aria-hidden="true"><span class="mfrac">a/b</span></span>';
    const formula = `<span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span>${visual}</span>`;
    const html = `<div class="prose" style="font-size:24px"><p>${formula} and ${formula}</p></div>`;
    const url = "data:image/png;base64,AA==";
    captureEquations.mockImplementationOnce(async ([source]) => new Map([[source, { url, width: 22, height: 34 }]]));
    const markdown = `$${tex}$ and $${tex}$`;

    expect(await copyFullText(markdown, html, path.join(current.workspace, "note.md"), "en")).toMatchObject({
      ok: true
    });
    expect(captureEquations).toHaveBeenCalledExactlyOnceWith(
      [
        {
          visual,
          context: [
            { tag: "div", style: "font-size: 24px" },
            { tag: "p", style: "" },
            { tag: "span", style: "" }
          ]
        }
      ],
      expect.any(Function),
      expect.any(AbortSignal)
    );
    const copied = writeClipboard.mock.calls[0][0];
    expect(copied.text).toBe(markdown);
    expect(copied.html?.match(new RegExp(`src="${url}"`, "g"))).toHaveLength(2);
    expect(copied.html).toContain(`alt="${tex}" width="22" height="34"`);
    expect(copied.html).not.toContain("<annotation");
    expect(reviewDialog).not.toHaveBeenCalled();
  });

  it("captures identical formulas separately when their surrounding typography differs", async () => {
    await mkdir(current.workspace);
    const visual = '<span class="katex-html"><span class="base">x</span></span>';
    const formula = `<span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">x</annotation></math></span>${visual}</span>`;
    const html = `<div class="prose" style="font-size:24px"><p>${formula} and ${formula}</p><h1 style="font-size:2em">${formula}</h1><blockquote style="--ink:#fff;color:var(--ink);font-size:0.9em"><p>${formula}</p></blockquote></div>`;
    const bodyImage = "data:image/png;base64,AA==";
    const headingImage = "data:image/png;base64,AQ==";
    const calloutImage = "data:image/png;base64,Ag==";
    captureEquations.mockImplementationOnce(async ([body, heading, callout]) => {
      expect(body.context).toContainEqual({ tag: "div", style: "font-size: 24px" });
      expect(heading.context).toContainEqual({ tag: "h1", style: "font-size: 2em" });
      expect(callout.context).toContainEqual({
        tag: "blockquote",
        style: "--ink: #fff;color: var(--ink);font-size: 0.9em"
      });
      return new Map([
        [body, { url: bodyImage, width: 12, height: 23 }],
        [heading, { url: headingImage, width: 24, height: 46 }],
        [callout, { url: calloutImage, width: 11, height: 21 }]
      ]);
    });

    expect(await copyFullText("$x$", html, path.join(current.workspace, "note.md"), "en")).toMatchObject({ ok: true });
    const sources = captureEquations.mock.calls[0][0];
    expect(sources.map((source) => source.visual)).toEqual([visual, visual, visual]);
    const copied = writeClipboard.mock.calls[0][0].html!;
    expect(Array.from(copied.matchAll(/<img src="([^"]+)"/g), ([, src]) => src)).toEqual([
      bodyImage,
      bodyImage,
      headingImage,
      calloutImage
    ]);
  });

  it("keeps rendered formulas and source text for equations that exceeded the capture deadline", async () => {
    await mkdir(current.workspace);
    const require = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
    const { renderToString } = require("katex") as { renderToString: typeof import("katex").renderToString };
    const tex = [String.raw`\frac{a}{b}`, "E=mc^2\n\\tag{2}"];
    const visual = '<span class="katex-html"><span class="base">a/b</span></span>';
    const first = `<span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">${tex[0]}</annotation></math></span>${visual}</span>`;
    const html = `${first} and ${renderToString(tex[1], { displayMode: true })}`;
    const url = "data:image/png;base64,AA==";
    captureEquations.mockImplementationOnce(async ([source]) => new Map([[source, { url, width: 22, height: 34 }]]));
    const markdown = tex.map((source) => `$${source}$`).join(" and ");

    expect(
      await copyFullText(markdown, `<p>${html}</p><p>End of note</p>`, path.join(current.workspace, "note.md"), "en")
    ).toMatchObject({ ok: true });
    expect(captureEquations.mock.calls[0][0][1].visual).toContain("position: static;");
    expect(captureEquations.mock.calls[0][0][1].visual).toContain("margin-inline-start: 1em;");
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({
      text: markdown,
      html: expect.stringContaining(`<code style="white-space: pre-wrap;">${tex[1]}</code>`)
    });
    expect(writeClipboard.mock.calls[0][0].html).toContain(`src="${url}"`);
    expect(writeClipboard.mock.calls[0][0].html).toContain("<p>End of note</p>");
  });

  it("reviews active SVG image references and embeds both SVG href formats for offline paste", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const figure = '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>';
    await writeFile(path.join(current.workspace, "figure.svg"), figure);
    const remote = "data:image/png;base64,AA==";
    downloadImage.mockResolvedValueOnce(remote);
    const html =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image href="figure.svg" xlink:href="private.svg"/><image xlink:href="https://example.com/node.png"/></svg>';

    expect(await copyFullText("Diagram", html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard.mock.calls[0][0].html).toContain(
      `href="data:image/svg+xml;base64,${Buffer.from(figure).toString("base64")}"`
    );
    expect(writeClipboard.mock.calls[0][0].html).toContain(`xlink:href="${remote}"`);
    expect(writeClipboard.mock.calls[0][0].html).not.toContain("private.svg");
    expect(downloadImage).toHaveBeenCalledExactlyOnceWith("https://example.com/node.png", expect.any(AbortSignal));
    expect(reviewDialog).not.toHaveBeenCalled();
  });

  it("reports and strips an unavailable SVG image from rich text", async () => {
    await mkdir(current.workspace);
    const html =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image href="missing.svg" xlink:href="unused.svg"/></svg>';
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText("Diagram", html, path.join(current.workspace, "note.md"), "en")).toMatchObject({
      ok: true
    });
    expect(reviewDialog.mock.calls[0][1].detail).toContain("missing.svg");
    expect(reviewDialog.mock.calls[0][1].detail).not.toContain("unused.svg");
    expect(writeClipboard.mock.calls[0][0].html).toContain("<image></image>");
  });

  it("cancels a copy started in a child workspace when its window has opened the parent", async () => {
    await mkdir(current.workspace);
    const originalWorkspace = current.workspace;
    const notePath = path.join(originalWorkspace, "note.md");
    const requestId = await beginCopy(notePath);
    await writeFile(path.join(root, "outside.txt"), "External file fixture");
    current.workspace = root;
    current.workspaceRevision += 1;

    expect(
      await invoke(
        "copy-full-text",
        requestId,
        "[Outside](../outside.txt)",
        '<a href="../outside.txt">Outside</a>',
        "en"
      )
    ).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
    expect(await invoke("begin-clipboard-copy", originalWorkspace, notePath)).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(reviewDialog).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("cancels a pending copy if the window returns to the same workspace with a new revision", async () => {
    await mkdir(current.workspace);
    await writeFile(path.join(current.workspace, "figure.svg"), "<svg></svg>");
    const notePath = path.join(current.workspace, "note.md");
    validateImages.mockImplementationOnce(async () => {
      current.workspaceRevision += 2;
      return [true];
    });

    expect(await copyFullText("![Figure](figure.svg)", '<img src="figure.svg">', notePath, "en")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("keeps a newer copy from another window when older image preparation finishes later", async () => {
    await mkdir(current.workspace);
    await writeFile(path.join(current.workspace, "figure.svg"), "<svg></svg>");
    const first = await beginCopy(path.join(current.workspace, "first.md"));
    const otherWindow = { senderFrame: {} } as Electron.IpcMainInvokeEvent;
    let finishDecode: (valid: boolean[]) => void = () => {};
    validateImages.mockReturnValueOnce(
      new Promise<boolean[]>((resolve) => {
        finishDecode = resolve;
      })
    );
    const slow = invoke("copy-full-text", first, "First", '<img src="figure.svg">', "en");
    try {
      await vi.waitFor(() => expect(validateImages).toHaveBeenCalledOnce());
      const second = await beginCopy(path.join(current.workspace, "second.md"), otherWindow);
      expect(await invokeFrom(otherWindow, "copy-full-text", second, "Second", "<p>Second</p>", "en")).toMatchObject({
        ok: true
      });
    } finally {
      finishDecode([true]);
    }

    expect(await slow).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: "Second", html: "<p>Second</p>" });
  });

  it("orders clipboard requests before rendering and keeps them bound to their initiating window", async () => {
    await mkdir(current.workspace);
    const otherWindow = { senderFrame: {} } as Electron.IpcMainInvokeEvent;
    const first = await beginCopy(path.join(current.workspace, "first.md"));
    const second = await beginCopy(path.join(current.workspace, "second.md"), otherWindow);
    expect(await invoke("copy-full-text", second, "Wrong window", "<p>Wrong window</p>", "en")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(await invokeFrom(otherWindow, "copy-full-text", second, "Second", "<p>Second</p>", "en")).toMatchObject({
      ok: true
    });
    expect(await invoke("copy-full-text", first, "First", "<p>First</p>", "en")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: "Second", html: "<p>Second</p>" });
  });

  it.each(["new copy", "workspace switch"])(
    "cancels a copy if a %s happens during the clipboard baseline sync",
    async (cause) => {
      await mkdir(current.workspace);
      let finishSync: (watch: ClipboardWatch) => void = () => {};
      watchClipboard.mockReturnValueOnce(
        new Promise((resolve) => {
          finishSync = resolve;
        })
      );
      const first = invoke("begin-clipboard-copy", current.workspace, path.join(current.workspace, "first.md"));
      expect(watchClipboard).toHaveBeenCalledOnce();

      let second: unknown;
      if (cause === "new copy") second = await beginCopy(path.join(current.workspace, "second.md"));
      else current.workspaceRevision++;
      finishSync({ unchanged: () => true, needsConfirmation: false, needsWindowFocus: true });

      expect(await first).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
      if (cause === "new copy") {
        expect(await invoke("copy-full-text", second, "Second", "<p>Second</p>", "en")).toMatchObject({ ok: true });
        expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: "Second", html: "<p>Second</p>" });
      }
    }
  );

  it.each(["relative path", "native selection", "another app", "WeChat"])(
    "keeps a newer %s copy when full-note image preparation is pending",
    async (source) => {
      await mkdir(current.workspace);
      await writeFile(path.join(current.workspace, "figure.svg"), "<svg></svg>");
      const request = await beginCopy(path.join(current.workspace, "note.md"));
      let finishDecode: (valid: boolean[]) => void = () => {};
      validateImages.mockReturnValueOnce(
        new Promise<boolean[]>((resolve) => {
          finishDecode = resolve;
        })
      );
      const oldCopy = invoke("copy-full-text", request, "Full note", '<img src="figure.svg">', "en");
      try {
        await vi.waitFor(() => expect(validateImages).toHaveBeenCalledOnce());
        if (source === "relative path") {
          expect(await invoke("copy-text-to-clipboard", "folder/note.md")).toMatchObject({ ok: true });
          expect(writeText).toHaveBeenCalledExactlyOnceWith("folder/note.md");
        } else if (source === "native selection") {
          listeners.get("export:native-clipboard-copy")!({} as Electron.IpcMainEvent);
        } else if (source === "another app") {
          // An external app can replace the HTML while retaining the same plain text and formats.
          systemClipboard.html = "<strong>Copied elsewhere</strong>";
        } else {
          const newer = await beginCopy(path.join(current.workspace, "wechat.md"));
          expect(await invoke("copy-html-to-clipboard", newer, "<p>For WeChat</p>")).toMatchObject({ ok: true });
          expect(writeHTML).toHaveBeenCalledExactlyOnceWith("<p>For WeChat</p>");
        }
      } finally {
        finishDecode([true]);
      }

      expect(await oldCopy).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
      expect(writeClipboard).not.toHaveBeenCalled();
    }
  );

  it("prevents a late WeChat render from replacing or cancelling a newer full-note copy", async () => {
    await mkdir(current.workspace);
    const first = await beginCopy(path.join(current.workspace, "wechat.md"));
    const second = await beginCopy(path.join(current.workspace, "note.md"));
    expect(await invoke("copy-html-to-clipboard", first, "<p>Older WeChat copy</p>")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(await invoke("copy-full-text", second, "Latest", "<p>Latest</p>", "en")).toMatchObject({ ok: true });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: "Latest", html: "<p>Latest</p>" });
    expect(writeHTML).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    "requires an explicit final clipboard write if selection notifications are unavailable (%s)",
    async (response) => {
      await mkdir(current.workspace);
      systemClipboard.text = "Already copied";
      systemClipboard.needsConfirmation = true;
      reviewDialog.mockImplementationOnce(async () => {
        expect(writeClipboard).not.toHaveBeenCalled();
        return { response };
      });

      const result = await copyFullText("Note", "<p>Note</p>", path.join(current.workspace, "note.md"), "en");

      expect(reviewDialog).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        expect.objectContaining({ buttons: ["Copy Now", "Cancel"] })
      );
      if (response === 0) {
        expect(result).toMatchObject({ ok: true });
        expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: "Note", html: "<p>Note</p>" });
      } else {
        expect(result).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
        expect(writeClipboard).not.toHaveBeenCalled();
      }
    }
  );

  it.each(["copy-full-text", "copy-html-to-clipboard"])(
    "requires a fresh action in the focused Wayland window to finish a %s request",
    async (channel) => {
      await mkdir(current.workspace);
      systemClipboard.needsConfirmation = true;
      systemClipboard.needsWindowFocus = true;
      window.focused = false;
      const request = await beginCopy(path.join(current.workspace, "note.md"));
      const copy =
        channel === "copy-full-text"
          ? invoke(channel, request, "Note", "<p>Note</p>", "en")
          : invoke(channel, request, "<p>Note</p>", "en");

      expect(await copy).toEqual({ ok: true, value: "confirmation-required" });
      expect(reviewDialog).not.toHaveBeenCalled();
      expect(window.listenerCount("focus")).toBe(0);
      systemClipboard.text = "Newer copy from another app";
      window.focused = true;
      window.emit("focus");
      await Promise.resolve();
      expect(writeClipboard).not.toHaveBeenCalled();
      expect(writeHTML).not.toHaveBeenCalled();

      expect(await invoke("confirm-clipboard-copy", request, true)).toMatchObject({ ok: true });
      expect(writeClipboard.mock.calls.length + writeHTML.mock.calls.length).toBe(1);
      expect(sendToRenderer).not.toHaveBeenCalled();
      expect(await invoke("confirm-clipboard-copy", request, true)).toMatchObject({
        ok: false,
        error: { message: "USER_CANCELLED" }
      });
      expect(window.listenerCount("closed")).toBe(0);
    }
  );

  it.each([
    "lost focus",
    "text copy",
    "native selection",
    "copy in another window",
    "workspace switch",
    "closed window"
  ])("invalidates a prepared Wayland copy after %s", async (reason) => {
    await mkdir(current.workspace);
    systemClipboard.needsConfirmation = true;
    systemClipboard.needsWindowFocus = true;
    const request = await beginCopy(path.join(current.workspace, "note.md"));
    expect(await invoke("copy-html-to-clipboard", request, "<p>Note</p>", "en")).toEqual({
      ok: true,
      value: "confirmation-required"
    });

    const otherWindow = { senderFrame: {} } as Electron.IpcMainInvokeEvent;
    expect(await invokeFrom(otherWindow, "confirm-clipboard-copy", request, true)).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    if (reason === "lost focus") window.focused = false;
    if (reason === "text copy") await invoke("copy-text-to-clipboard", "Newer copy");
    if (reason === "native selection") listeners.get("export:native-clipboard-copy")!(event as Electron.IpcMainEvent);
    if (reason === "copy in another window") await beginCopy(path.join(current.workspace, "other.md"), otherWindow);
    if (reason === "workspace switch") current.workspaceRevision++;
    if (reason === "closed window") {
      window.destroyed = true;
      window.emit("closed");
    }
    if (["text copy", "native selection", "copy in another window"].includes(reason)) {
      expect(sendToRenderer).toHaveBeenCalledExactlyOnceWith("export:clipboard-copy-superseded", request);
    } else {
      expect(sendToRenderer).not.toHaveBeenCalled();
    }

    expect(await invoke("confirm-clipboard-copy", request, true)).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    window.focused = true;
    window.emit("focus");
    expect(writeHTML).not.toHaveBeenCalled();
    expect(window.listenerCount("closed")).toBe(0);
  });

  it.each(["closed", "no focus"])("cancels a Wayland write when its originating window is %s", async (outcome) => {
    await mkdir(current.workspace);
    vi.useFakeTimers();
    systemClipboard.needsWindowFocus = true;
    window.focused = false;
    const request = await beginCopy(path.join(current.workspace, "note.md"));
    const copy = invoke("copy-html-to-clipboard", request, "<p>Note</p>", "en");
    await vi.waitFor(() => expect(window.listenerCount("focus")).toBe(1));
    if (outcome === "closed") {
      window.destroyed = true;
      window.emit("closed");
    } else {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    expect(await copy).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
    expect(writeHTML).not.toHaveBeenCalled();
    expect(window.listenerCount("focus")).toBe(0);
    expect(window.listenerCount("closed")).toBe(0);
  });

  it("checks focus again when an asynchronous Wayland clipboard check finishes", async () => {
    await mkdir(current.workspace);
    systemClipboard.needsWindowFocus = true;
    const request = await beginCopy(path.join(current.workspace, "note.md"));
    checkClipboard.mockImplementationOnce(async () => {
      window.focused = false;
      return true;
    });

    expect(await invoke("copy-html-to-clipboard", request, "<p>Note</p>", "en")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(writeHTML).not.toHaveBeenCalled();
  });

  it("cancels a superseded Wayland copy immediately while it is waiting for window focus", async () => {
    await mkdir(current.workspace);
    vi.useFakeTimers();
    systemClipboard.needsWindowFocus = true;
    window.focused = false;
    const request = await beginCopy(path.join(current.workspace, "note.md"));
    const completed = vi.fn();
    const copying = invoke("copy-html-to-clipboard", request, "<p>Note</p>", "en").then(completed);

    try {
      await vi.waitFor(() => expect(window.listenerCount("focus")).toBe(1));
      expect(await invoke("copy-text-to-clipboard", "newer")).toMatchObject({ ok: true });
      await vi.waitFor(() => expect(completed).toHaveBeenCalledOnce(), { timeout: 500 });
      expect(completed).toHaveBeenCalledWith({
        ok: false,
        error: expect.objectContaining({ message: "USER_CANCELLED" })
      });
      expect(window.listenerCount("focus")).toBe(0);
      expect(writeHTML).not.toHaveBeenCalled();
    } finally {
      window.emit("focus");
      await copying;
    }
  });

  it("preserves a copy from another app while waiting for resource confirmation", async () => {
    await mkdir(current.workspace);
    await writeFile(path.join(root, "outside.txt"), "External file fixture");
    reviewDialog.mockImplementationOnce(async () => {
      systemClipboard.text = "From another app";
      return { response: 0, checkboxChecked: true };
    });
    expect(
      await copyFullText(
        "External",
        '<a href="../outside.txt">External</a>',
        path.join(current.workspace, "note.md"),
        "en"
      )
    ).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
    expect(reviewDialog).toHaveBeenCalledOnce();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it.each(["resource review", "unmonitored clipboard confirmation"])(
    "closes a superseded %s and lets the earlier copy finish",
    async (kind) => {
      await mkdir(current.workspace);
      await writeFile(path.join(root, "outside.txt"), "External file fixture");
      const note = path.join(current.workspace, "note.md");
      const html = kind === "resource review" ? '<a href="../outside.txt">External</a>' : "<p>Note</p>";
      systemClipboard.needsConfirmation = kind !== "resource review";

      let closeDialog: (choice: { response: number }) => void = () => {};
      reviewDialog.mockImplementationOnce((_window, options: Electron.MessageBoxOptions) => {
        return new Promise((resolve) => {
          closeDialog = resolve;
          options.signal?.addEventListener("abort", () => resolve({ response: 1 }), { once: true });
        });
      });

      const copying = copyFullText("Note", html, note, "en");
      try {
        await vi.waitFor(() => expect(reviewDialog).toHaveBeenCalledOnce());
        expect(await invoke("copy-text-to-clipboard", "newer")).toMatchObject({ ok: true });
        expect(reviewDialog.mock.calls[0][1].signal?.aborted).toBe(true);
        expect(await copying).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
        expect(writeText).toHaveBeenCalledExactlyOnceWith("newer");
        expect(writeClipboard).not.toHaveBeenCalled();
      } finally {
        closeDialog({ response: 1 });
        await copying;
      }
    }
  );

  it("rechecks the clipboard after reading approved attachment bytes", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const attachment = path.join(current.workspace, "report.pdf");
    await writeFile(attachment, "PDF fixture");
    const reviewedPath = await fs.realpath(attachment);
    const open = fs.open;
    let attachmentOpens = 0;
    vi.spyOn(fs, "open").mockImplementation(async (file, ...options) => {
      const handle = await open(file, ...options);
      if (file === reviewedPath && ++attachmentOpens === 2) systemClipboard.text = "Copied while embedding";
      return handle;
    });

    expect(await copyFullText("Report", '<a href="report.pdf">Report</a>', notePath, "en")).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(attachmentOpens).toBe(2);
    expect(reviewDialog).not.toHaveBeenCalled();
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it.each(["path copy", "native selection"])("cancels old attachment reads after a newer %s", async (source) => {
    await mkdir(current.workspace);
    const first = path.join(current.workspace, "first.pdf");
    const second = path.join(current.workspace, "second.pdf");
    await Promise.all([writeFile(first, "First fixture"), writeFile(second, "Second fixture")]);
    const [firstPath, secondPath] = await Promise.all([fs.realpath(first), fs.realpath(second)]);
    const open = fs.open;
    const firstBytes = Buffer.from("First fixture");
    const encodeFirst = vi.spyOn(firstBytes, "toString");
    let readingHandle: FileHandle | undefined;
    let readSignal: AbortSignal | undefined;
    let finishRead: () => void = () => {};
    let secondOpens = 0;
    vi.spyOn(fs, "open").mockImplementation(async (filename, ...options) => {
      const handle = await open(filename, ...options);
      if (filename === secondPath) secondOpens++;
      if (filename === firstPath) {
        vi.spyOn(handle, "readFile").mockImplementationOnce((readOptions) => {
          readingHandle = handle;
          readSignal = typeof readOptions === "object" ? readOptions?.signal : undefined;
          return new Promise((resolve, reject) => {
            finishRead = () => resolve(firstBytes);
            if (source === "path copy") {
              readSignal?.addEventListener(
                "abort",
                () => reject(new DOMException("The operation was aborted", "AbortError")),
                { once: true }
              );
            }
          });
        });
      }
      return handle;
    });

    const html = '<a href="first.pdf">First</a><a href="second.pdf">Second</a>';
    const copying = copyFullText("Note", html, path.join(current.workspace, "note.md"), "en");
    try {
      await vi.waitFor(() => expect(readingHandle).toBeDefined());
      if (source === "path copy") expect(await invoke("copy-text-to-clipboard", "newer")).toMatchObject({ ok: true });
      else listeners.get("export:native-clipboard-copy")!(event as Electron.IpcMainEvent);

      expect(readSignal?.aborted).toBe(true);
      // The final read can finish just as the signal aborts.
      if (source === "native selection") finishRead();
      expect(await copying).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
      expect(readingHandle?.fd).toBe(-1);
      expect(secondOpens).toBe(1); // Reviewed for availability, never opened for embedding.
      expect(encodeFirst).not.toHaveBeenCalled();
      expect(writeClipboard).not.toHaveBeenCalled();
    } finally {
      finishRead();
      await copying;
    }
  });

  it("stops image downloads when a newer copy supersedes resource preparation", async () => {
    await mkdir(current.workspace);
    let finishDownload: (value: null) => void = () => {};
    downloadImage.mockImplementationOnce((_url, signal) => {
      return new Promise((resolve) => {
        finishDownload = resolve;
        signal.addEventListener("abort", () => resolve(null), { once: true });
      });
    });
    const copying = copyFullText(
      "Note",
      '<img src="https://example.com/slow.png">',
      path.join(current.workspace, "note.md"),
      "en"
    );
    try {
      await vi.waitFor(() => expect(downloadImage).toHaveBeenCalledOnce());
      expect(await invoke("copy-text-to-clipboard", "newer")).toMatchObject({ ok: true });
      expect(downloadImage.mock.calls[0][1].aborted).toBe(true);
      expect(await copying).toMatchObject({ ok: false, error: { message: "USER_CANCELLED" } });
      expect(reviewDialog).not.toHaveBeenCalled();
      expect(writeClipboard).not.toHaveBeenCalled();
    } finally {
      finishDownload(null);
      await copying;
    }
  });

  it("keeps download space for images that can fit at their actual reference count", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const oversized = "data:image/png;base64,".padEnd(12 * 1024 * 1024, "A");
    const valid = "data:image/png;base64,dmFsaWQgZml4dHVyZQ==";
    downloadImage.mockImplementation(async (url) => (url.endsWith("/valid.png") ? valid : oversized));
    const repeated = Array.from({ length: 4 }, (_, index) =>
      `<img src="https://example.com/repeated-${index}.png">`.repeat(5)
    ).join("");
    const html = repeated + '<img alt="Valid" src="https://example.com/valid.png">';
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(html, html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard.mock.calls[0][0].html).toContain(`<img alt="Valid" src="${valid}">`);
    expect(reviewDialog.mock.calls[0][1].detail).toContain("repeated-0.png");
    expect(reviewDialog.mock.calls[0][1].detail).not.toContain("valid.png");
  });

  it("keeps smaller remote images after default workspace files use most of the clipboard capacity", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(report, "");
    await fs.truncate(report, 32 * 1024 * 1024);
    const base = "https://example.com/";
    const large = "data:image/png;base64,".padEnd(12 * 1024 * 1024, "A");
    const small = "data:image/png;base64,".padEnd(1024 * 1024, "B");
    const urls = Array.from({ length: 4 }, (_, index) => `${base}large-${index}.png`);
    downloadImage.mockImplementation(async (url) => (url === `${base}small.png` ? small : large));
    const pages = [
      '<a href="report.pdf">Report</a>' + [...urls, `${base}small.png`].map((url) => `<img src="${url}">`).join("")
    ];

    const assets = await inspectExportAssets(pages, notePath, current.workspace, "clipboard", validateImages);

    expect(assets.local.has("attachment:report.pdf")).toBe(true);
    expect([...assets.remote.keys()]).toEqual([`${base}small.png`]);
    expect(assets.missing).toEqual(urls.map((url) => ({ name: url.replace("https://", ""), reason: "size" })));
    expect(validateImages).toHaveBeenCalledExactlyOnceWith([small]);
  });

  it("reclaims capacity before considering the next image if an earlier image did not decode", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(report, "");
    await fs.truncate(report, 32 * 1024 * 1024);
    const corrupt = "data:image/png;base64,".padEnd(4 * 1024 * 1024, "A");
    const valid = "data:image/png;base64,".padEnd(4 * 1024 * 1024, "B");
    downloadImage.mockResolvedValueOnce(corrupt).mockResolvedValueOnce(valid);
    validateImages.mockResolvedValueOnce([false]).mockResolvedValueOnce([true]);
    const pages = [
      '<a href="report.pdf">Report</a><img src="https://example.com/corrupt.png"><img src="https://example.com/valid.png">'
    ];

    const assets = await inspectExportAssets(pages, notePath, current.workspace, "clipboard", validateImages);

    expect([...assets.remote.keys()]).toEqual(["https://example.com/valid.png"]);
    expect(assets.missing).toEqual([{ name: "example.com/corrupt.png", reason: "decode" }]);
  });

  it("keeps time to download later images when an earlier batch needs decoding between downloads", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(report, "");
    await fs.truncate(report, 32 * 1024 * 1024);
    const image = "data:image/png;base64,".padEnd(3 * 1024 * 1024, "A");
    const small = "data:image/png;base64,c21hbGw=";
    const images = ["slow", "fits", "missing-1", "missing-2", "small"];
    const html =
      '<a href="report.pdf">Report</a>' + images.map((name) => `<img src="https://example.com/${name}.png">`).join("");
    let time = 0;
    const timers: Array<{ deadline: number; controller: AbortController }> = [];
    vi.spyOn(performance, "now").mockImplementation(() => time);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      timers.push({ deadline: time + ms, controller });
      return controller.signal;
    });
    function elapse(ms: number) {
      time += ms;
      for (const { deadline, controller } of timers) {
        if (time >= deadline) controller.abort();
      }
    }
    downloadImage.mockImplementation(async (url) => {
      if (url.endsWith("/slow.png")) elapse(7_900);
      if (url.endsWith("/slow.png") || url.endsWith("/fits.png")) return image;
      return url.endsWith("/small.png") ? small : null;
    });
    validateImages.mockImplementationOnce(async () => {
      elapse(7_500);
      return [false];
    });

    const assets = await inspectExportAssets([html], notePath, current.workspace, "clipboard", validateImages);

    expect([...assets.remote.keys()]).toEqual(["https://example.com/fits.png", "https://example.com/small.png"]);
  });

  it.each([false, true])("reviews external files before including their bytes (include=%s)", async (include) => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    await writeFile(path.join(root, "outside.txt"), "external file fixture");
    const markdown = "[Outside](../outside.txt)";
    const html = '<a href="../outside.txt">Outside</a>';
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: include });

    expect(await copyFullText(markdown, html, notePath, "zh")).toMatchObject({ ok: true });
    expect(reviewDialog).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({
        title: "检查复制资源",
        buttons: ["继续复制", "取消"],
        detail: expect.stringContaining("outside.txt"),
        checkboxChecked: false
      })
    );
    const copied = writeClipboard.mock.calls[0][0];
    expect(copied.text).toBe(markdown);
    expect(copied.html).toBe(
      include
        ? `<a href="data:application/octet-stream;base64,${Buffer.from("external file fixture").toString("base64")}" download="outside.txt">Outside</a>`
        : "<a>Outside</a>"
    );
  });

  it("omits hidden and unsupported workspace files from the rich-text clipboard", async () => {
    await mkdir(path.join(current.workspace, ".settings"), { recursive: true });
    const notePath = path.join(current.workspace, "note.md");
    const fileNames = [".draft.pdf", ".settings/preferences.json", "notes.fixture"];
    await Promise.all(fileNames.map((name) => writeFile(path.join(current.workspace, name), `Contents of ${name}`)));
    const markdown = fileNames.map((name) => `[File](${name})`).join("\n");
    const html = fileNames.map((name) => `<a href="${name}">File</a>`).join("");
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: true });

    expect(await copyFullText(markdown, html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: markdown, html: "<a>File</a>".repeat(3) });
    expect(reviewDialog.mock.calls[0][1].detail).toContain("preferences.json");
  });

  it.skipIf(process.platform === "win32")("omits workspace links that resolve into a hidden directory", async () => {
    const hidden = path.join(current.workspace, ".settings");
    await mkdir(hidden, { recursive: true });
    const source = path.join(hidden, "preferences.json");
    await writeFile(source, "Private settings fixture");
    await fs.symlink(source, path.join(current.workspace, "preferences.json"));
    const markdown = "[File](preferences.json)";
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(
      await copyFullText(markdown, '<a href="preferences.json">File</a>', path.join(current.workspace, "note.md"), "en")
    ).toMatchObject({ ok: true });
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: markdown, html: "<a>File</a>" });
  });

  it("keeps a workspace attachment when earlier external files exceed the remaining budget", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const outside = path.join(root, "outside.zip");
    const inside = path.join(current.workspace, "report.pdf");
    await writeFile(outside, "");
    await writeFile(inside, "");
    await fs.truncate(outside, 33 * 1024 * 1024);
    await fs.truncate(inside, 4 * 1024 * 1024);
    const markdown = "[Outside](../outside.zip)\n\n[Report](report.pdf)";
    const html = '<a href="../outside.zip">Outside</a><a href="report.pdf">Report</a>';
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(markdown, html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard.mock.calls[0][0].html).toContain('download="report.pdf"');
    expect(writeClipboard.mock.calls[0][0].html).toContain("<a>Outside</a>");
    expect(reviewDialog.mock.calls[0][1].detail).toContain("outside.zip");
    expect(reviewDialog.mock.calls[0][1].detail).not.toContain("report.pdf");
  });

  it("reserves clipboard space for embeddable resources only", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const unsupportedBackground = path.join(current.workspace, "background.zip");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(unsupportedBackground, "");
    await writeFile(report, "");
    await fs.truncate(unsupportedBackground, 33 * 1024 * 1024);
    await fs.truncate(report, 4 * 1024 * 1024);
    const html = '<p style="background-image: url(background.zip)"><a href="report.pdf">Report</a></p>';
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(html, html, notePath, "en")).toMatchObject({ ok: true });
    expect(writeClipboard.mock.calls[0][0].html).toContain('download="report.pdf"');
    expect(reviewDialog.mock.calls[0][1].detail).toContain("background.zip");
    expect(reviewDialog.mock.calls[0][1].detail).not.toContain("report.pdf");
  });

  it("counts each copy of an inline URL in posters and CSS before reserving workspace files", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(report, "");
    await fs.truncate(report, 33 * 1024 * 1024);
    const data = "data:image/png;base64,".padEnd(2 * 1024 * 1024, "A");
    const html = `<video poster="${data}"></video><p style="background-image: url('${data}')"><a href="report.pdf">Report</a></p>`;

    const assets = await inspectExportAssets([html], notePath, current.workspace, "clipboard", validateImages);

    expect(assets.inline.has(data)).toBe(true);
    expect(assets.missing).toEqual([{ name: await fs.realpath(report), reason: "size" }]);
    const copied = await embedExportAssets(html, assets, false, "Omitted from copy", "clipboard");
    expect(copied.split(data)).toHaveLength(3);
    expect(copied).toContain("<a>Report</a>");
  });

  it("reports and removes repeated pre-embedded media that exceed clipboard capacity", async () => {
    const data = "data:image/png;base64,".padEnd(5 * 1024 * 1024, "A");
    const page = `<video poster="${data}"></video>`;
    const assets = await inspectExportAssets(Array(10).fill(page), undefined, undefined, "clipboard", validateImages);

    expect(assets.inline.size).toBe(0);
    expect(assets.missing).toEqual([{ name: "data:image/png", reason: "size" }]);
    expect(await embedExportAssets(page, assets, false, "Omitted from copy", "clipboard")).toBe("<video></video>");
  }, 15000);

  it("skips external images that cannot fit before giving the remaining images to the decoder", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const report = path.join(current.workspace, "report.pdf");
    await writeFile(report, "");
    await fs.truncate(report, 32 * 1024 * 1024);
    const large = await Promise.all(
      Array.from({ length: 4 }, async (_, index) => {
        const filename = `large-${index}.png`;
        const outside = path.join(root, filename);
        await writeFile(outside, "");
        await fs.truncate(outside, 6 * 1024 * 1024);
        return filename;
      })
    );
    const small = path.join(root, "small.svg");
    await writeFile(small, '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>');
    const html =
      '<a href="report.pdf">Report</a>' +
      [...large, "small.svg"].map((filename) => `<img src="../${filename}">`).join("");

    const assets = await inspectExportAssets([html], notePath, current.workspace, "clipboard", validateImages);

    expect(assets.externalFiles).toEqual([await fs.realpath(small)]);
    expect(assets.missing).toHaveLength(4);
    expect(assets.missing.every(({ reason }) => reason === "size")).toBe(true);
    expect(validateImages).toHaveBeenCalledExactlyOnceWith([expect.stringContaining("small.svg")]);
  });

  it("gives workspace images a decoding slot before optional external images", async () => {
    await mkdir(current.workspace);
    const figure = '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>';
    await Promise.all(
      Array.from({ length: 4 }, (_, index) => writeFile(path.join(root, `external-${index}.svg`), figure))
    );
    await writeFile(path.join(current.workspace, "workspace.svg"), figure);
    const html =
      Array.from({ length: 4 }, (_, index) => `<img src="../external-${index}.svg">`).join("") +
      '<img alt="Default image" src="workspace.svg">';
    // Slow external images can exhaust the decoder's four concurrent slots.
    validateImages.mockImplementationOnce(async (sources) =>
      sources.map((source, index) => index < 4 && source.endsWith("/workspace.svg"))
    );
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(html, html, path.join(current.workspace, "note.md"), "en")).toMatchObject({
      ok: true
    });
    expect(writeClipboard.mock.calls[0][0].html).toContain('<img alt="Default image" src="data:image/svg+xml;base64,');
  });

  it("keeps a video source when the same file fails to decode as its poster", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const video = "MP4 fixture bytes";
    await writeFile(path.join(current.workspace, "movie.mp4"), video);
    const html = '<video controls src="movie.mp4" poster="movie.mp4"></video>';
    validateImages.mockResolvedValueOnce([false]);
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(html, html, notePath, "en")).toMatchObject({ ok: true });
    expect(validateImages).toHaveBeenCalledExactlyOnceWith(
      [expect.stringContaining("movie.mp4")],
      expect.any(AbortSignal)
    );
    expect(writeClipboard.mock.calls[0][0].html).toContain(
      `src="data:video/mp4;base64,${Buffer.from(video).toString("base64")}"`
    );
    expect(writeClipboard.mock.calls[0][0].html).not.toContain("poster=");
    expect(reviewDialog.mock.calls[0][1].detail).toContain("Image could not be decoded");
  });

  it("leaves the clipboard untouched when resource review is cancelled", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    await writeFile(path.join(root, "outside.txt"), "external file fixture");
    reviewDialog.mockResolvedValueOnce({ response: 1, checkboxChecked: true });

    expect(
      await copyFullText("[Outside](../outside.txt)", '<a href="../outside.txt">Outside</a>', notePath, "en")
    ).toMatchObject({
      ok: false,
      error: { message: "USER_CANCELLED" }
    });
    expect(writeClipboard).not.toHaveBeenCalled();
  });

  it("can copy the note when a file exceeds the clipboard resource limit", async () => {
    await mkdir(current.workspace);
    const notePath = path.join(current.workspace, "note.md");
    const large = path.join(current.workspace, "large.zip");
    await writeFile(large, "");
    await fs.truncate(large, 48 * 1024 * 1024);
    const markdown = "[Large](large.zip)";
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await copyFullText(markdown, '<a href="large.zip">Large</a>', notePath, "en")).toMatchObject({
      ok: true
    });
    expect(reviewDialog).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ detail: expect.stringContaining("Exceeds the clipboard resource size limit") })
    );
    expect(writeClipboard).toHaveBeenCalledExactlyOnceWith({ text: markdown, html: "<a>Large</a>" });
  });

  it("removes all staged pages on failure and can retry to the same target", async () => {
    const output = path.join(root, "pages");
    await select(output);
    capture.mockResolvedValueOnce({ toPNG: () => Buffer.from("first") });
    capture.mockRejectedValueOnce(new Error("second page failed"));

    expect(await invoke("export-as-image-pages", ["first", "second"], output, "note")).toMatchObject({
      ok: false,
      error: { message: "second page failed" }
    });
    expect(await readdir(root)).toEqual([]);

    await select(output);
    const files = [path.join(output, "note-1.png"), path.join(output, "note-2.png")];
    expect(await invoke("export-as-image-pages", ["first", "second"], output, "note")).toEqual({
      ok: true,
      value: { filesCount: 2, filePaths: files }
    });
    expect(await Promise.all(files.map((file) => readFile(file, "utf8")))).toEqual(["first", "second"]);
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("keeps the user's existing directory and index intact during HTML export", async () => {
    const output = path.join(root, "existing");
    const index = path.join(output, "index.html");
    await mkdir(output);
    await writeFile(index, "original HTML");
    await select(output);

    expect(await invoke("export-html-package", "export content", output)).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("already exists") }
    });
    expect(await readFile(index, "utf8")).toBe("original HTML");
    expect(await readdir(output)).toEqual(["index.html"]);
  });

  it("reviews external resources once for each HTML export and removes unshipped local URLs", async () => {
    await mkdir(current.workspace);
    const source = path.join(root, "external.svg");
    await writeFile(source, "<svg></svg>");
    const notePath = path.join(current.workspace, "note.md");
    const html = `<img alt="Figure" src="../external.svg"><a href="../private.txt">Private</a><img src="https://example.com/figure.png">`;

    for (const include of [true, false]) {
      const output = path.join(root, include ? "with-figure" : "without-figure");
      await select(output);
      reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: include });
      expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
      expect(reviewDialog).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          detail: expect.stringContaining("external.svg"),
          checkboxChecked: false
        })
      );
      const exported = await readFile(path.join(output, "index.html"), "utf8");
      expect(exported).not.toContain("../external.svg");
      expect(exported).not.toContain("private.txt");
      expect(exported).toContain("https://example.com/figure.png");
      expect(await readdir(path.join(output, "assets"))).toEqual(include ? ["external.svg"] : []);
      expect(exported).toContain(include ? "./assets/external.svg" : "Figure (Omitted from export)");
    }
    expect(reviewDialog).toHaveBeenCalledTimes(2);
  });

  it("publishes no HTML package if the external file is replaced during confirmation", async () => {
    await mkdir(current.workspace);
    const source = path.join(root, "external.svg");
    const output = path.join(root, "package");
    const notePath = path.join(current.workspace, "note.md");
    const html = '<img src="../external.svg">';
    await writeFile(source, "reviewed file");
    await select(output);
    reviewDialog.mockImplementationOnce(async () => {
      await rename(source, path.join(root, "reviewed.svg"));
      await writeFile(source, "replacement file");
      return { response: 0, checkboxChecked: true };
    });

    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({
      ok: false,
      error: { message: "Export asset changed: external.svg" }
    });
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });

    await select(output);
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: true });
    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
    expect(await readFile(path.join(output, "assets", "external.svg"), "utf8")).toBe("replacement file");
  });

  it("reports an unreadable file before saving, using the selected app language in the dialog and output", async () => {
    await mkdir(current.workspace);
    const workspace = await fs.realpath(current.workspace);
    const blocked = path.join(workspace, "blocked.svg");
    await writeFile(blocked, "unreadable fixture");
    await writeFile(path.join(workspace, "readable.svg"), "<svg></svg>");
    const actualOpen = fs.open;
    vi.spyOn(fs, "open").mockImplementation((file, ...options) =>
      file === blocked
        ? Promise.reject(Object.assign(new Error("Permission denied"), { code: "EACCES" }))
        : actualOpen(file, ...options)
    );
    const html = '<img alt="Blocked" src="./blocked.svg"><img alt="Available" src="./readable.svg">';
    const notePath = path.join(workspace, "note.md");
    const output = path.join(root, "reviewed");
    await select(output, "zh");
    reviewDialog.mockResolvedValueOnce({ response: 0, checkboxChecked: false });

    expect(await invoke("export-html-package", html, output, notePath)).toMatchObject({ ok: true });
    expect(reviewDialog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "检查导出资源",
        detail: expect.stringContaining("blocked.svg (无法读取文件)")
      })
    );
    expect(await readdir(path.join(output, "assets"))).toEqual(["readable.svg"]);
    expect(await readFile(path.join(output, "index.html"), "utf8")).toContain("Blocked (未纳入导出)");
    expect(await invoke("prepare-html-preview", html, notePath, "未纳入导出")).toMatchObject({
      ok: true,
      value: expect.stringContaining("Blocked (未纳入导出)")
    });
  });

  it.skipIf(process.platform === "win32")(
    "publishes with ordinary directory permissions from a private staging area",
    async () => {
      const output = path.join(root, "published");
      const regular = path.join(root, "regular");
      await mkdir(regular);
      const stagedFile = await writeExportDirectory(output, async (stagedOutput) => {
        const privateDirectory = await stat(path.dirname(stagedOutput));
        expect(privateDirectory.mode & 0o077).toBe(0);
        await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
        const source = path.join(stagedOutput, "index.html");
        await writeFile(source, "exported");
        return stat(source);
      });

      expect((await stat(output)).mode & 0o777).toBe((await stat(regular)).mode & 0o777);
      const index = path.join(output, "index.html");
      expect(await stat(index)).toMatchObject({ dev: stagedFile.dev, ino: stagedFile.ino, nlink: 1 });
      expect(await readFile(index, "utf8")).toBe("exported");
      expect((await readdir(root)).sort()).toEqual(["published", "regular"]);
    }
  );

  it("publishes exclusively and removes staging when the volume cannot hard-link files", async () => {
    vi.spyOn(fs, "link").mockRejectedValue(Object.assign(new Error("Unsupported hard links"), { code: "ENOTSUP" }));
    const outputPath = path.join(root, "export.html");
    const destination = await inspectExportDestination(outputPath);
    await writeExportFile(destination, "exported");
    await expect(writeExportFile(destination, "later export")).rejects.toThrow("destination changed");
    expect(await readFile(outputPath, "utf8")).toBe("exported");
    expect(await readdir(root)).toEqual(["export.html"]);
  });

  it("exports a new file to a directory that permits files but denies creating directories", async () => {
    const denyDirectory = vi
      .spyOn(fs, "mkdtemp")
      .mockRejectedValue(Object.assign(new Error("Cannot create directories"), { code: "EACCES" }));
    const outputPath = path.join(root, "export.png");
    const destination = await inspectExportDestination(outputPath);
    await writeExportFile(destination, Buffer.from("image"));
    expect(denyDirectory).not.toHaveBeenCalled();
    expect(await readFile(outputPath, "utf8")).toBe("image");
    expect(await readdir(root)).toEqual(["export.png"]);
  });

  it.each([false, true])("preserves a competing export directory with fallback=%s", async (fallback) => {
    const output = path.join(root, "pages");
    if (fallback) {
      vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(
        Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
      );
    }
    await expect(
      writeExportDirectory(output, async (staged) => {
        for (const page of ["one.png", "two.png"]) await writeFile(path.join(staged, page), "staged page");
        await mkdir(output);
        await writeFile(path.join(output, "unrelated.png"), "user file");
      })
    ).rejects.toThrow("already exists");
    expect(await readdir(output)).toEqual(["unrelated.png"]);
    expect(await readFile(path.join(output, "unrelated.png"), "utf8")).toBe("user file");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("rolls back and retries when the export volume supports neither exclusive rename nor hard links", async () => {
    const output = path.join(root, "pages");
    const failure = Object.assign(new Error("Volume is full"), { code: "ENOSPC" });
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValue(
      Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
    );
    vi.spyOn(fs, "link").mockRejectedValue(Object.assign(new Error("Unsupported hard links"), { code: "ENOTSUP" }));
    const open = fs.open;
    vi.spyOn(fs, "open").mockImplementationOnce(open).mockRejectedValueOnce(failure);
    const prepare = async (staged: string) => {
      const assets = path.join(staged, "assets");
      await mkdir(assets);
      await writeFile(path.join(assets, "index.html"), "contents");
      await writeFile(path.join(assets, "poster.png"), "image");
    };

    await expect(writeExportDirectory(output, prepare)).rejects.toThrow(failure);
    expect(await readdir(root)).toEqual([]);
    await writeExportDirectory(output, prepare);
    const assets = path.join(output, "assets");
    expect(await readFile(path.join(assets, "index.html"), "utf8")).toBe("contents");
    expect(await readFile(path.join(assets, "poster.png"), "utf8")).toBe("image");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("aborts fallback publication if another directory replaces the reserved one", async () => {
    const output = path.join(root, "pages");
    const moved = path.join(root, "moved");
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(
      Object.assign(new Error("Unsupported exclusive rename"), { code: "ENOTSUP" })
    );
    const linkFile = fs.link;
    const link = vi.spyOn(fs, "link").mockImplementationOnce(async (source, destination) => {
      await linkFile(source, destination);
      await rename(output, moved);
      await mkdir(output);
      await writeFile(path.join(output, "unrelated.png"), "user file");
    });

    await expect(
      writeExportDirectory(output, async (staged) => {
        for (const page of ["one.png", "two.png"]) await writeFile(path.join(staged, page), "staged page");
      })
    ).rejects.toThrow("destination changed");
    expect(link).toHaveBeenCalledTimes(1);
    expect(await readdir(output)).toEqual(["unrelated.png"]);
    expect(await readFile(path.join(output, "unrelated.png"), "utf8")).toBe("user file");
    expect((await readdir(root)).sort()).toEqual(["moved", "pages"]);
  });

  it("leaves the destination free to retry after publication fails", async () => {
    const output = path.join(root, "pages");
    const failure = Object.assign(new Error("Publication failed"), { code: "EIO" });
    vi.spyOn(exclusiveRename, "renameExclusive").mockRejectedValueOnce(failure);
    const prepare = async (staged: string) => {
      const assets = path.join(staged, "assets");
      await mkdir(assets);
      await writeFile(path.join(assets, "page.png"), "exported");
    };

    await expect(writeExportDirectory(output, prepare)).rejects.toThrow(failure);
    expect(await readdir(root)).toEqual([]);
    await writeExportDirectory(output, prepare);
    expect(await readFile(path.join(output, "assets", "page.png"), "utf8")).toBe("exported");
    expect(await readdir(root)).toEqual(["pages"]);
  });

  it("overwrites the approved inode without losing its access controls", async () => {
    const output = path.join(root, "export.html");
    await writeFile(output, "old HTML", { mode: 0o640 });
    const previous = await stat(output);
    await select(output);
    expect(await invoke("save-html-file", output, "新")).toMatchObject({ ok: true });
    expect(await invoke("save-html-file", output, "second save")).toMatchObject({ ok: false });
    expect(await stat(output)).toMatchObject({ dev: previous.dev, ino: previous.ino, mode: previous.mode });
    expect(await readFile(output, "utf8")).toBe("新");
    expect(await readdir(root)).toEqual(["export.html"]);
  });

  it("reserves the directory even when both writers prepare empty outputs", async () => {
    const output = path.join(root, "same-folder");
    let release!: () => void;
    const prepared = new Promise<void>((resolve) => (release = resolve));
    let preparedCount = 0;
    const prepare = async () => {
      preparedCount++;
      if (preparedCount === 2) release();
      await prepared;
    };

    const results = await Promise.allSettled([
      writeExportDirectory(output, prepare),
      writeExportDirectory(output, prepare)
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results).toContainEqual({
      status: "rejected",
      reason: expect.objectContaining({ message: expect.stringContaining("already exists") })
    });
    expect(await readdir(root)).toEqual(["same-folder"]);
  });

  it("rejects an overwrite if the selected file was replaced before export", async () => {
    const output = path.join(root, "existing.html");
    const moved = path.join(root, "moved.html");
    await writeFile(output, "original file");
    await select(output);
    await rename(output, moved);
    await writeFile(output, "other file");

    expect(await invoke("save-html-file", output, "exported")).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("destination changed") }
    });
    expect(await readFile(moved, "utf8")).toBe("original file");
    expect(await readFile(output, "utf8")).toBe("other file");
  });

  it("preserves a user file added after destination selection while a capture is running", async () => {
    const output = path.join(root, "capture.png");
    await select(output);
    capture.mockImplementationOnce(async () => {
      await writeFile(output, "concurrent writer");
      return { toPNG: () => Buffer.from("image") };
    });

    expect(await invoke("export-as-image", "<p>capture</p>", output)).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining("destination changed") }
    });
    expect(await readFile(output, "utf8")).toBe("concurrent writer");
    expect(await readdir(root)).toEqual(["capture.png"]);
  });

  it.each([false, true])("allows one concurrent export to a destination with existing=%s", async (existing) => {
    const output = path.join(root, "concurrent.html");
    if (existing) await writeFile(output, "approved earlier file");
    const first = await inspectExportDestination(output);
    const second = await inspectExportDestination(output);
    const versions = ["first export", "other export"];

    const results = await Promise.allSettled([
      writeExportFile(first, versions[0]),
      writeExportFile(second, versions[1])
    ]);

    const winner = results.findIndex((result) => result.status === "fulfilled");
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results[1 - winner]).toMatchObject({ status: "rejected", reason: expect.any(Error) });
    expect(await readFile(output, "utf8")).toBe(versions[winner]);
    expect(await readdir(root)).toEqual(["concurrent.html"]);
  });
});
