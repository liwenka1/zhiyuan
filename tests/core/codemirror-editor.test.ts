import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as typeof import("jsdom");

vi.mock("@/ipc", () => ({ utilsIpc: { getPathForFile: vi.fn() } }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("real Markdown editor initialization", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllGlobals();
  });

  it.each([false, true])(
    "creates and edits a view using the UI wrapper state and actual extensions (dark=%s)",
    async (isDark) => {
      const dom = new JSDOM("<div id='editor'></div>", { pretendToBeVisual: true });
      const browser = dom.window;
      for (const key of [
        "window",
        "document",
        "navigator",
        "Node",
        "HTMLElement",
        "MutationObserver",
        "Window",
        "Document"
      ] as const) {
        vi.stubGlobal(key, key === "window" ? browser : key === "document" ? browser.document : browser[key]);
      }
      vi.stubGlobal("getComputedStyle", browser.getComputedStyle.bind(browser));
      vi.stubGlobal("requestAnimationFrame", browser.requestAnimationFrame.bind(browser));
      vi.stubGlobal("cancelAnimationFrame", browser.cancelAnimationFrame.bind(browser));

      const { EditorState, EditorView } = await import("@uiw/react-codemirror");
      const { useCodemirrorExtensions } =
        await import("../../apps/desktop/src/renderer/src/features/editor/hooks/use-codemirror-extensions");
      const { extensions, theme } = useCodemirrorExtensions({ isDark });
      const original = "# Temporary note\n\n```python\nprint('hello')\n```";
      const state = EditorState.create({ doc: original, extensions: [...extensions, theme] });
      const view = new EditorView({ state, parent: browser.document.getElementById("editor")! });
      cleanup = () => {
        view.destroy();
        browser.close();
      };
      expect(browser.document.querySelector(".cm-content")?.textContent).toContain("Temporary note");
      view.dispatch({ changes: { from: state.doc.length, insert: "\n\nEdited" } });
      expect(view.state.doc.toString()).toBe(`${original}\n\nEdited`);
      expect(view.contentDOM.textContent).toContain("Edited");
    }
  );
});
