// @vitest-environment jsdom

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { ShortcutId } from "@shared";

vi.mock("@/ipc", () => ({
  configIpc: {},
  fileIpc: {},
  folderIpc: {},
  githubIpc: {},
  themeIpc: {},
  utilsIpc: {},
  watcherIpc: {},
  workspaceIpc: {}
}));

async function loadEditorModules() {
  await import("@/lib/i18n");
  return Promise.all([
    import("react"),
    import("react-dom/client"),
    import("@codemirror/view"),
    import("@/features/editor/components/editor-content"),
    import("@/hooks/use-shortcut-dispatcher"),
    import("@/stores")
  ] as const);
}

let editorModules: Awaited<ReturnType<typeof loadEditorModules>>;

beforeAll(async () => {
  // CodeMirror reads the platform during module initialization.
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh)");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const createRange = document.createRange.bind(document);
  vi.spyOn(document, "createRange").mockImplementation(() =>
    Object.assign(createRange(), { getClientRects: () => [], getBoundingClientRect: () => new DOMRect() })
  );

  editorModules = await loadEditorModules();
}, 30_000);

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("gives configured app shortcuts priority over CodeMirror keymaps only when app dispatch is allowed", async () => {
  const [
    { act, createElement, useState },
    { createRoot },
    { EditorView },
    { EditorContent },
    { useShortcutDispatcher },
    { useShortcutsStore }
  ] = editorModules;
  const { shortcuts } = useShortcutsStore.getState();
  const openUrlCreateDialog = vi.fn();
  const openSettings = vi.fn();
  const context = {
    openSettings,
    openCreateFolderDialog: vi.fn(),
    openRssImportDialog: vi.fn(),
    openUrlCreateDialog,
    toggleNoteSearch: vi.fn(),
    formatNote: vi.fn()
  };

  interface HarnessOptions {
    enabled?: boolean;
    allowedShortcuts?: ReadonlySet<ShortcutId>;
  }

  function Harness(options: HarnessOptions) {
    const [content, setContent] = useState("A note");
    useShortcutDispatcher({ context, ...options });
    return createElement(EditorContent, { content, onChange: setContent });
  }

  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const render = (options: HarnessOptions = {}) => act(() => root.render(createElement(Harness, options)));
  try {
    await render();
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>(".cm-editor")!)!;
    view.focus();
    expect(document.activeElement).toBe(view.contentDOM);

    const pressKey = async (key: string, options: KeyboardEventInit = {}, target = view.contentDOM) => {
      const letter = key.toUpperCase();
      const event = new KeyboardEvent("keydown", {
        key,
        code: `Key${letter}`,
        keyCode: letter.charCodeAt(0),
        metaKey: true,
        shiftKey: letter === key,
        bubbles: true,
        cancelable: true,
        ...options
      });
      await act(() => {
        target.dispatchEvent(event);
      });
      return event;
    };

    await pressKey("U");
    expect(openUrlCreateDialog).toHaveBeenCalledOnce();

    await act(() =>
      useShortcutsStore.setState({
        shortcuts: { ...shortcuts, openSettings: { ...shortcuts.openSettings, code: "KeyL", shift: true } }
      })
    );
    await pressKey("L");
    expect(openSettings).toHaveBeenCalledOnce();
    await pressKey("L", { isComposing: true });
    await pressKey("L", { repeat: true });
    view.contentDOM.addEventListener("keydown", (event) => event.preventDefault(), { capture: true, once: true });
    await pressKey("L");
    expect(openSettings).toHaveBeenCalledOnce();

    const outside = host.appendChild(document.createElement("button"));
    outside.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
    await pressKey("L", {}, outside);
    expect(openSettings).toHaveBeenCalledOnce();
    await pressKey("L", {}, outside);
    expect(openSettings).toHaveBeenCalledTimes(2);

    await render({ allowedShortcuts: new Set(["createNoteFromUrl"]) });
    expect((await pressKey("L")).defaultPrevented).toBe(true);
    expect(openSettings).toHaveBeenCalledTimes(2);
    await render({ enabled: false });
    expect((await pressKey("U")).defaultPrevented).toBe(true);
    expect(openUrlCreateDialog).toHaveBeenCalledOnce();
    await render();

    await act(() => view.dispatch({ changes: { from: 0, insert: "Edited " } }));
    await pressKey("z");
    expect(view.state.doc.toString()).toBe("A note");
    await pressKey("Z");
    expect(view.state.doc.toString()).toBe("Edited A note");

    await act(() =>
      useShortcutsStore.setState({
        shortcuts: { ...shortcuts, createNoteFromUrl: { ...shortcuts.createNoteFromUrl, code: "KeyJ" } }
      })
    );
    const previousAnchor = view.state.selection.main.anchor;
    const nextAnchor = previousAnchor === 0 ? 1 : 0;
    await act(() => view.dispatch({ selection: { anchor: nextAnchor }, userEvent: "select" }));
    await pressKey("u");
    expect(view.state.selection.main.anchor).toBe(previousAnchor);
    await pressKey("U");
    expect(view.state.selection.main.anchor).toBe(nextAnchor);
    expect(openUrlCreateDialog).toHaveBeenCalledOnce();
    await pressKey("J");
    expect(openUrlCreateDialog).toHaveBeenCalledTimes(2);

    const optionBackspace = { code: "Backspace", keyCode: 8, altKey: true, metaKey: false, shiftKey: false };
    const settingsCalls = openSettings.mock.calls.length;
    await act(() => {
      useShortcutsStore.setState({
        shortcuts: {
          ...shortcuts,
          openSettings: { code: "Backspace", alt: true, ctrl: false, shift: false, meta: false }
        }
      });
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    });
    expect((await pressKey("Backspace", optionBackspace)).defaultPrevented).toBe(true);
    expect((await pressKey("Backspace", { ...optionBackspace, repeat: true })).defaultPrevented).toBe(true);
    expect(openSettings).toHaveBeenCalledTimes(settingsCalls + 1);
    expect(view.state.doc.toString()).toBe("Edited A note");

    await render({ allowedShortcuts: new Set(["createNoteFromUrl"]) });
    await pressKey("Backspace", { ...optionBackspace, repeat: true });
    expect(openSettings).toHaveBeenCalledTimes(settingsCalls + 1);
    expect(view.state.doc.toString()).toBe("Edited A ");
  } finally {
    try {
      await act(() => root.unmount());
    } finally {
      host.remove();
      useShortcutsStore.setState({ shortcuts });
    }
  }
}, 15_000);
