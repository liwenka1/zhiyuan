import { app, type BrowserWindow } from "electron";
import fs from "node:fs/promises";

const EDITED_CONTENT = "# Desktop smoke edited\n\nSaved through the real editor.\n";

/** Exercise the production renderer, CodeMirror input, and the real persistence pipeline. */
export function startDesktopSmokeTest(window?: BrowserWindow): void {
  if (process.env.ZHIYUAN_SMOKE_TEST !== "1") return;
  const notePath = process.env.ZHIYUAN_SMOKE_NOTE;
  if (!window || !notePath) {
    console.error("ZHIYUAN_SMOKE_NO_FIXTURE_WINDOW");
    app.exit(1);
    return;
  }

  const timeout = setTimeout(() => {
    console.error("ZHIYUAN_SMOKE_TIMEOUT");
    app.exit(1);
  }, 20_000);
  const run = async () => {
    try {
      const initial = await fs.readFile(notePath, "utf8");
      const deadline = Date.now() + 15_000;
      let editorReady = false;
      while (Date.now() < deadline) {
        editorReady = await window.webContents.executeJavaScript(`
          (() => {
            const editor = document.querySelector('.cm-content[contenteditable="true"]');
            if (editor) return Array.from(editor.querySelectorAll('.cm-line')).map(line => line.textContent).join('\\n') === ${JSON.stringify(initial)};
            const note = document.querySelector('[data-note-item="true"] button');
            if (note) note.click();
            return false;
          })()
        `);
        if (editorReady) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!editorReady) throw new Error("The fixture note did not mount a working Markdown editor");
      await window.webContents.executeJavaScript(`
        (() => {
          const editor = document.querySelector('.cm-content[contenteditable="true"]');
          editor.focus();
          document.execCommand('selectAll');
        })()
      `);
      await window.webContents.insertText(EDITED_CONTENT);
      let saved = false;
      while (Date.now() < deadline) {
        if ((await fs.readFile(notePath, "utf8")) === EDITED_CONTENT) {
          saved = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!saved) throw new Error("CodeMirror input was not persisted to the fixture note");
      clearTimeout(timeout);
      console.log("ZHIYUAN_SMOKE_READY: editor opened, edited and saved");
      app.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      console.error("ZHIYUAN_SMOKE_FAILED", error);
      app.exit(1);
    }
  };
  if (window.webContents.isLoadingMainFrame()) window.webContents.once("did-finish-load", () => void run());
  else void run();
}
