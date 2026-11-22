import { app, dialog, nativeImage, type BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const EDITED_CONTENT = "# Desktop smoke edited\n\nSaved through the real editor.\n";
const EXPORT_WIDTH = 320;
const EXPORT_HEIGHT = 900;

interface SmokeDomState {
  readyState: string;
  rootChildCount: number;
  editorCount: number;
  editableEditorCount: number;
  editorLineCount: number;
  editorTextLength: number | null;
  expectedTextLength: number;
  editorTextMatches: boolean;
  noteRowCount: number;
  selectedNoteRowCount: number;
  busyRegionCount: number;
  inertRegionCount: number;
  errorToastCount: number;
}

/** Return counts and comparisons, never note text, filenames or page HTML. */
export function buildDesktopSmokeStateScript(expectedText: string): string {
  return `
    (() => {
      const editors = document.querySelectorAll('.cm-content');
      const editableEditors = document.querySelectorAll('.cm-content[contenteditable="true"]');
      const editor = editableEditors[0];
      const lines = editor ? Array.from(editor.querySelectorAll('.cm-line')) : [];
      const text = editor ? lines.map(line => line.textContent).join('\\n') : null;
      const expected = ${JSON.stringify(expectedText)};
      const rows = Array.from(document.querySelectorAll('[data-note-item="true"]'));
      return {
        readyState: document.readyState,
        rootChildCount: document.getElementById('root')?.childElementCount ?? 0,
        editorCount: editors.length,
        editableEditorCount: editableEditors.length,
        editorLineCount: lines.length,
        editorTextLength: text === null ? null : text.length,
        expectedTextLength: expected.length,
        editorTextMatches: text === expected,
        noteRowCount: rows.length,
        selectedNoteRowCount: rows.filter(row => row.querySelector('.bg-accent.opacity-100, [aria-selected="true"]')).length,
        busyRegionCount: document.querySelectorAll('[aria-busy="true"]').length,
        inertRegionCount: document.querySelectorAll('[inert]').length,
        errorToastCount: document.querySelectorAll('[data-sonner-toast][data-type="error"]').length
      };
    })()
  `;
}

export function buildDesktopSmokeSelectionScript(expectedText: string): string {
  return `
    (() => {
      const editor = document.querySelector('.cm-content[contenteditable="true"]');
      if (!editor) return false;
      editor.focus();
      document.execCommand('selectAll');
      return document.hasFocus() && document.activeElement === editor && window.getSelection()?.toString() === ${JSON.stringify(expectedText)};
    })()
  `;
}

function runTerminalSmoke(window: BrowserWindow): Promise<boolean> {
  return window.webContents.executeJavaScript(`
    (async () => {
      const terminal = window.api.terminal;
      const id = crypto.randomUUID();
      let complete;
      const result = new Promise(resolve => { complete = resolve; });
      const timeout = setTimeout(() => complete(false), 5000);
      const marker = "zhiyuan-pty-ready";
      let tail = "";
      const stopData = terminal.onData(({ id: sessionId, data }) => {
        if (sessionId !== id) return;
        const output = tail + data;
        if (output.includes(marker)) complete(true);
        tail = output.slice(1 - marker.length);
      });
      const stopExit = terminal.onExit(({ id: sessionId }) => {
        if (sessionId === id) complete(false);
      });
      try {
        const create = await terminal.create(id);
        if (!create.ok) throw new Error(create.error.message);
        const write = await terminal.write(id, "printf '%s%s\\\\n' 'zhiyuan-pty-' 'ready'\\r");
        if (!write.ok) throw new Error(write.error.message);
        return await result;
      } finally {
        clearTimeout(timeout);
        stopData();
        stopExit();
        await terminal.dispose(id);
      }
    })()
  `);
}

async function runExportSmoke(window: BrowserWindow, notePath: string): Promise<void> {
  const profile = process.env.ZHIYUAN_SMOKE_USER_DATA;
  if (!profile) throw new Error("Export smoke requires an isolated profile");
  const outputPath = path.join(profile, "capture.png");
  const packagePath = path.join(profile, "HTML package");
  const originalShowSaveDialog = dialog.showSaveDialog;
  let selectedPath = outputPath;
  // Supply the fixture destination where the native picker would return the user's selection.
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: selectedPath });
  try {
    await window.webContents.executeJavaScript(`
      (async () => {
        const api = window.api.export;
        const selection = await api.showSaveDialog({ title: "Smoke capture", defaultPath: "capture.png", filters: [] });
        if (!selection.ok || !selection.value) throw new Error("Smoke export destination was not selected");
        const html = '<!doctype html><body style="margin:0"><div style="height:${EXPORT_HEIGHT}px">Export fixture</div></body>';
        const result = await api.exportAsImage(html, selection.value, ${JSON.stringify(notePath)}, { width: ${EXPORT_WIDTH} });
        if (!result.ok) throw new Error(result.error.message);
      })()
    `);
    const image = nativeImage.createFromPath(outputPath);
    const { width, height } = image.getSize();
    if (image.isEmpty() || width <= 0 || height * EXPORT_WIDTH < width * EXPORT_HEIGHT) {
      throw new Error("Export capture did not produce a full page");
    }
    selectedPath = packagePath;
    await window.webContents.executeJavaScript(`
      (async () => {
        const api = window.api.export;
        const selection = await api.showSaveDialog({ title: "Smoke HTML package", defaultPath: "HTML package", filters: [] });
        if (!selection.ok || !selection.value) throw new Error("Smoke package destination was not selected");
        const result = await api.exportHTMLPackage("<p>Export fixture</p>", selection.value, undefined);
        if (!result.ok) throw new Error(result.error.message);
      })()
    `);
    if (!(await fs.readFile(path.join(packagePath, "index.html"), "utf8")).includes("<p>Export fixture</p>")) {
      throw new Error("Export did not publish the HTML package");
    }
  } finally {
    dialog.showSaveDialog = originalShowSaveDialog;
  }
}

/** Exercise the production renderer, CodeMirror input, and the real persistence pipeline. */
export function startDesktopSmokeTest(window?: BrowserWindow): void {
  if (process.env.ZHIYUAN_SMOKE_TEST !== "1") return;
  const notePath = process.env.ZHIYUAN_SMOKE_NOTE;
  if (!window || !notePath) {
    console.error("ZHIYUAN_SMOKE_NO_FIXTURE_WINDOW");
    app.exit(1);
    return;
  }

  let finished = false;
  let stage = "waiting-for-load";
  let lastDomState: SmokeDomState | null = null;
  let fixtureText: string | undefined;
  const redactFixture = (message: string) => {
    let result = message;
    for (const fixture of [notePath, process.env.ZHIYUAN_SMOKE_USER_DATA, fixtureText, EDITED_CONTENT]) {
      if (fixture) result = result.replaceAll(fixture, "<smoke-fixture>");
    }
    return result.slice(0, 2000);
  };
  const onConsoleMessage = (details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>) => {
    if (details.level === "error") {
      console.error("ZHIYUAN_SMOKE_RENDERER_ERROR", redactFixture(details.message));
    }
  };
  const onDidFailLoad = (
    _event: Electron.Event,
    errorCode: number,
    errorDescription: string,
    _url: string,
    isMainFrame: boolean
  ) => {
    console.error("ZHIYUAN_SMOKE_LOAD_ERROR", { errorCode, errorDescription, isMainFrame });
  };
  const onRenderProcessGone = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
    console.error("ZHIYUAN_SMOKE_RENDERER_GONE", { reason: details.reason, exitCode: details.exitCode });
  };
  window.webContents.on("console-message", onConsoleMessage);
  window.webContents.on("did-fail-load", onDidFailLoad);
  window.webContents.on("render-process-gone", onRenderProcessGone);
  const onDidFinishLoad = () => void run();

  const finish = (result: { error: unknown } | { success: true }) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    window.webContents.off("console-message", onConsoleMessage);
    window.webContents.off("did-fail-load", onDidFailLoad);
    window.webContents.off("render-process-gone", onRenderProcessGone);
    window.webContents.off("did-finish-load", onDidFinishLoad);
    if ("error" in result) {
      const error = result.error;
      console.error("ZHIYUAN_SMOKE_STATE", { stage, dom: lastDomState });
      console.error(
        "ZHIYUAN_SMOKE_FAILED",
        redactFixture(error instanceof Error ? (error.stack ?? error.message) : String(error))
      );
      app.exit(1);
    } else {
      console.log("ZHIYUAN_SMOKE_READY: editor opened, edited and saved");
      app.quit();
    }
  };
  const timeout = setTimeout(() => {
    console.error("ZHIYUAN_SMOKE_TIMEOUT");
    finish({ error: new Error("Desktop smoke exceeded its 20 second deadline") });
  }, 20_000);
  const run = async () => {
    try {
      stage = "reading-fixture";
      const initial = await fs.readFile(notePath, "utf8");
      fixtureText = initial;
      const deadline = Date.now() + 15_000;
      stage = "waiting-for-editor";
      let editorReady = false;
      while (!finished && Date.now() < deadline) {
        const domState: SmokeDomState = await window.webContents.executeJavaScript(
          buildDesktopSmokeStateScript(initial)
        );
        lastDomState = domState;
        editorReady = domState.editorTextMatches;
        if (editorReady) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (finished) return;
      if (!editorReady) throw new Error("The startup file was not automatically selected in a working Markdown editor");
      stage = "focusing-editor";
      let selectionReady = false;
      while (!finished && Date.now() < deadline) {
        window.focus();
        window.webContents.focus();
        selectionReady =
          (await window.webContents.executeJavaScript(buildDesktopSmokeSelectionScript(initial))) === true;
        if (selectionReady) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (finished) return;
      if (!selectionReady)
        throw new Error("The Markdown editor could not be focused with the complete startup text selected");
      stage = "editing";
      await window.webContents.insertText(EDITED_CONTENT);
      stage = "waiting-for-save";
      let saved = false;
      while (!finished && Date.now() < deadline) {
        if ((await fs.readFile(notePath, "utf8")) === EDITED_CONTENT) {
          saved = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (finished) return;
      if (!saved) throw new Error("CodeMirror input was not persisted to the fixture note");
      if (process.env.ZHIYUAN_SMOKE_TERMINAL === "1") {
        stage = "starting-terminal";
        if ((await runTerminalSmoke(window)) !== true) throw new Error("The terminal did not return shell output");
        if (finished) return;
        console.log("ZHIYUAN_SMOKE_TERMINAL_READY");
      }
      if (process.env.ZHIYUAN_SMOKE_EXPORT === "1") {
        stage = "exporting-image";
        await runExportSmoke(window, notePath);
        if (finished) return;
        console.log("ZHIYUAN_SMOKE_EXPORT_READY");
      }
      finish({ success: true });
    } catch (error) {
      finish({ error });
    }
  };
  if (window.webContents.isLoadingMainFrame()) window.webContents.once("did-finish-load", onDidFinishLoad);
  else void run();
}
