import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exit: vi.fn(), readFile: vi.fn() }));
vi.mock("electron", () => ({ app: { exit: mocks.exit } }));
vi.mock("node:fs/promises", () => ({ default: { readFile: mocks.readFile } }));

import {
  buildDesktopSmokeSelectionScript,
  buildDesktopSmokeStateScript,
  startDesktopSmokeTest
} from "../../apps/desktop/src/main/desktop-smoke";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as typeof import("jsdom");
const INITIAL_CONTENT = "# Fixture\n\nInitial content.\n";
const EDITED_CONTENT = "# Desktop smoke edited\n\nSaved through the real editor.\n";
const emptyState = {
  readyState: "complete",
  rootChildCount: 1,
  editorCount: 0,
  editableEditorCount: 0,
  editorLineCount: 0,
  editorTextLength: null,
  expectedTextLength: INITIAL_CONTENT.length,
  editorTextMatches: false,
  noteRowCount: 1,
  selectedNoteRowCount: 0,
  busyRegionCount: 0,
  inertRegionCount: 0,
  errorToastCount: 0
};

function makeWindow(loading = false) {
  const webContents = Object.assign(new EventEmitter(), {
    isLoadingMainFrame: vi.fn(() => loading),
    focus: vi.fn(),
    executeJavaScript: vi.fn().mockResolvedValue(emptyState),
    insertText: vi.fn().mockResolvedValue(undefined)
  });
  return { webContents, window: { focus: vi.fn(), webContents } as unknown as BrowserWindow };
}

describe("desktop smoke DOM diagnostics", () => {
  it("compares CodeMirror lines with real newlines including an empty final line", () => {
    const dom = new JSDOM(
      '<main id="root"><div data-note-item="true"><div class="bg-accent opacity-100"></div></div><div class="cm-content" contenteditable="true"></div></main>',
      {
        runScripts: "outside-only"
      }
    );
    try {
      const editor = dom.window.document.querySelector(".cm-content")!;
      for (const text of INITIAL_CONTENT.split("\n")) {
        const line = dom.window.document.createElement("div");
        line.className = "cm-line";
        line.textContent = text;
        editor.appendChild(line);
      }
      const state = dom.window.eval(buildDesktopSmokeStateScript(INITIAL_CONTENT));
      expect(state).toMatchObject({
        editorCount: 1,
        editableEditorCount: 1,
        editorLineCount: 4,
        editorTextLength: INITIAL_CONTENT.length,
        editorTextMatches: true,
        noteRowCount: 1,
        selectedNoteRowCount: 1
      });
      expect(JSON.stringify(state)).not.toContain("Initial content.");
      expect(
        dom.window.eval(buildDesktopSmokeStateScript(INITIAL_CONTENT.replace("Initial", "Changed")))
      ).toMatchObject({
        editorTextMatches: false
      });
    } finally {
      dom.window.close();
    }
  });

  it("distinguishes a missing editor from a non-editable editor without recording page content", () => {
    const dom = new JSDOM(
      '<div id="root"><div aria-busy="true" inert><div data-note-item="true">private-title.md</div></div><div data-sonner-toast data-type="error"></div></div>',
      {
        runScripts: "outside-only"
      }
    );
    try {
      const state = dom.window.eval(buildDesktopSmokeStateScript(INITIAL_CONTENT));
      expect(state).toMatchObject({
        editorCount: 0,
        editableEditorCount: 0,
        editorTextLength: null,
        editorTextMatches: false,
        noteRowCount: 1,
        busyRegionCount: 1,
        inertRegionCount: 1,
        errorToastCount: 1
      });
      expect(JSON.stringify(state)).not.toContain("private-title.md");
      const editor = dom.window.document.createElement("div");
      editor.className = "cm-content";
      editor.setAttribute("contenteditable", "false");
      dom.window.document.body.appendChild(editor);
      expect(dom.window.eval(buildDesktopSmokeStateScript(INITIAL_CONTENT))).toMatchObject({
        editorCount: 1,
        editableEditorCount: 0,
        editorTextLength: null,
        editorTextMatches: false
      });
    } finally {
      dom.window.close();
    }
  });

  it("requires document focus, editor focus and the complete startup selection before native input", () => {
    const dom = new JSDOM('<div class="cm-content" contenteditable="true" tabindex="0"></div>', {
      runScripts: "outside-only"
    });
    try {
      const editor = dom.window.document.querySelector<HTMLElement>(".cm-content")!;
      const hasFocus = vi.spyOn(dom.window.document, "hasFocus").mockReturnValue(true);
      const selection = vi
        .spyOn(dom.window, "getSelection")
        .mockReturnValue({ toString: () => INITIAL_CONTENT } as Selection);
      Object.defineProperty(dom.window.document, "execCommand", { value: vi.fn(() => true) });
      const script = buildDesktopSmokeSelectionScript(INITIAL_CONTENT);
      expect(dom.window.eval(script)).toBe(true);
      hasFocus.mockReturnValue(false);
      expect(dom.window.eval(script)).toBe(false);
      hasFocus.mockReturnValue(true);
      selection.mockReturnValue({ toString: () => "" } as Selection);
      expect(dom.window.eval(script)).toBe(false);
      selection.mockReturnValue({ toString: () => INITIAL_CONTENT } as Selection);
      editor.blur();
      vi.spyOn(editor, "focus").mockImplementation(() => undefined);
      expect(dom.window.eval(script)).toBe(false);
      editor.remove();
      expect(dom.window.eval(script)).toBe(false);
    } finally {
      dom.window.close();
      vi.restoreAllMocks();
    }
  });
});

describe("desktop smoke lifecycle diagnostics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("ZHIYUAN_SMOKE_TEST", "1");
    vi.stubEnv("ZHIYUAN_SMOKE_NOTE", "/tmp/fixture/workspace/smoke.md");
    vi.stubEnv("ZHIYUAN_SMOKE_USER_DATA", "/tmp/fixture/user-data");
    mocks.exit.mockReset();
    mocks.readFile.mockReset().mockResolvedValue(INITIAL_CONTENT);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not attach diagnostic listeners outside smoke mode", () => {
    vi.stubEnv("ZHIYUAN_SMOKE_TEST", "");
    const { window, webContents } = makeWindow();
    startDesktopSmokeTest(window);
    expect(webContents.eventNames()).toEqual([]);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("reports the final DOM state when automatic startup selection fails", async () => {
    const { window, webContents } = makeWindow();
    startDesktopSmokeTest(window);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_STATE", { stage: "waiting-for-editor", dom: emptyState });
    expect(console.error).toHaveBeenCalledWith(
      "ZHIYUAN_SMOKE_FAILED",
      expect.stringContaining("The startup file was not automatically selected")
    );
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(webContents.insertText).not.toHaveBeenCalled();
    expect(webContents.eventNames()).toEqual([]);
  });

  it("records renderer errors and load failures only in smoke mode, with fixture paths redacted", async () => {
    const { window, webContents } = makeWindow(true);
    startDesktopSmokeTest(window);
    webContents.emit("console-message", { level: "warning", message: "ignored warning" });
    webContents.emit("console-message", {
      level: "error",
      message: "Editor failed at /tmp/fixture/workspace/smoke.md using /tmp/fixture/user-data"
    });
    webContents.emit("did-fail-load", {}, -2, "ERR_FAILED", "file:///private-path.html", true);
    webContents.emit("render-process-gone", {}, { reason: "crashed", exitCode: 9 });
    expect(console.error).toHaveBeenCalledWith(
      "ZHIYUAN_SMOKE_RENDERER_ERROR",
      "Editor failed at <smoke-fixture> using <smoke-fixture>"
    );
    expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_LOAD_ERROR", {
      errorCode: -2,
      errorDescription: "ERR_FAILED",
      isMainFrame: true
    });
    expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_RENDERER_GONE", { reason: "crashed", exitCode: 9 });
    expect(console.error).not.toHaveBeenCalledWith(expect.anything(), "ignored warning");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_STATE", { stage: "waiting-for-load", dom: null });
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(webContents.listenerCount("console-message")).toBe(0);
    expect(webContents.listenerCount("did-fail-load")).toBe(0);
    expect(webContents.listenerCount("render-process-gone")).toBe(0);
  });

  it("waits for a verified complete selection before real editor input and exact disk-save checks", async () => {
    const { window, webContents } = makeWindow();
    webContents.executeJavaScript
      .mockResolvedValueOnce({ ...emptyState, editorCount: 1, editableEditorCount: 1, editorTextMatches: true })
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mocks.readFile.mockResolvedValueOnce(INITIAL_CONTENT).mockResolvedValueOnce(EDITED_CONTENT);
    startDesktopSmokeTest(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(webContents.insertText).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(window.focus).toHaveBeenCalledTimes(2);
    expect(webContents.focus).toHaveBeenCalledTimes(2);
    expect(webContents.insertText).toHaveBeenCalledExactlyOnceWith(EDITED_CONTENT);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(0);
    expect(console.log).toHaveBeenCalledWith("ZHIYUAN_SMOKE_READY: editor opened, edited and saved");
    expect(console.error).not.toHaveBeenCalled();
    expect(webContents.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails when editor input does not reach disk, and distinguishes that stage from startup selection", async () => {
    const { window, webContents } = makeWindow();
    const state = { ...emptyState, editorCount: 1, editableEditorCount: 1, editorTextMatches: true };
    webContents.executeJavaScript.mockResolvedValueOnce(state).mockResolvedValue(true);
    startDesktopSmokeTest(window);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(webContents.insertText).toHaveBeenCalledExactlyOnceWith(EDITED_CONTENT);
    expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_STATE", { stage: "waiting-for-save", dom: state });
    expect(console.error).toHaveBeenCalledWith(
      "ZHIYUAN_SMOKE_FAILED",
      expect.stringContaining("CodeMirror input was not persisted")
    );
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(console.log).not.toHaveBeenCalled();
  });

  it.each([false, { selectionReady: true }])(
    "never inserts text without a strict successful selection result (%j)",
    async (selectionResult) => {
      const { window, webContents } = makeWindow();
      const state = { ...emptyState, editorCount: 1, editableEditorCount: 1, editorTextMatches: true };
      webContents.executeJavaScript.mockResolvedValueOnce(state).mockResolvedValue(selectionResult);
      startDesktopSmokeTest(window);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(webContents.insertText).not.toHaveBeenCalled();
      expect(mocks.readFile).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith("ZHIYUAN_SMOKE_STATE", { stage: "focusing-editor", dom: state });
      expect(console.error).toHaveBeenCalledWith(
        "ZHIYUAN_SMOKE_FAILED",
        expect.stringContaining("complete startup text selected")
      );
      expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
      expect(console.log).not.toHaveBeenCalled();
    }
  );

  it("never treats a rejected operation without an error value as a successful smoke", async () => {
    const { window, webContents } = makeWindow();
    webContents.executeJavaScript.mockRejectedValue(undefined);
    startDesktopSmokeTest(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
