// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInstance, type i18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "sonner";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewContent } from "@/features/editor/components/preview-content";
import { EditorToolbar } from "@/features/editor/components/editor-toolbar";
import { MarkdownRenderer } from "@/features/editor/components/markdown-renderer";
import { useNoteExport, type UseNoteExportReturn } from "@/features/export/hooks/use-note-export";
import { useViewStore } from "@/stores/use-view-store";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import enEditor from "@/locales/en/editor.json";
import enNote from "@/locales/en/note.json";
import zhEditor from "@/locales/zh/editor.json";

const {
  buildDocument,
  preparePreview,
  buildClipboard,
  buildWechatClipboard,
  beginCopy,
  finishCopy,
  finishWechatCopy,
  confirmCopy,
  beginSwitch,
  renderMarkdown,
  noteSelection
} = vi.hoisted(() => ({
  buildDocument: vi.fn(),
  preparePreview: vi.fn(),
  buildClipboard: vi.fn(),
  buildWechatClipboard: vi.fn(),
  beginCopy: vi.fn(),
  finishCopy: vi.fn(),
  finishWechatCopy: vi.fn(),
  confirmCopy: vi.fn(),
  beginSwitch: vi.fn(),
  renderMarkdown: vi.fn(),
  noteSelection: { id: "first-note" }
}));

vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/features/export/lib", async () => import("@/features/export/lib/export-preview-html"));
vi.mock("@/features/export/lib/export-pipeline", () => ({
  buildExportDocumentFromMarkdown: buildDocument,
  buildClipboardDocument: buildClipboard,
  buildWechatClipboardDocument: buildWechatClipboard
}));
vi.mock("@/features/export/lib/styles", () => ({
  DEFAULT_EXPORT_THEME_ID: "default",
  buildProseStyleBundle: () => ({ colors: { background: "#fff" } })
}));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/ipc", () => ({ shellIpc: {} }));
vi.mock("@/lib/markdown-processor", () => ({ markdownToHTML: renderMarkdown }));
vi.mock("@/stores", async () => ({
  ...(await import("@/stores/use-view-store")),
  ...(await import("@/stores/use-export-layout-store")),
  ...(await import("@/stores/use-export-theme-store")),
  useNoteStore: (
    select: (state: { selectedNoteId: string; getSelectedNote: () => { id: string; title: string } }) => unknown
  ) =>
    select({
      selectedNoteId: noteSelection.id,
      getSelectedNote: () => ({ id: noteSelection.id, title: noteSelection.id })
    }),
  useThemeStore: (select: (state: { theme: string }) => string) => select({ theme: "light" })
}));

let container: HTMLDivElement;
let root: Root;
let locale: i18n;
let notifySuperseded: ((requestId: number) => void) | undefined;

function render(child: ReactNode) {
  return act(async () => {
    root.render(createElement(I18nextProvider, { i18n: locale }, child));
  });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("api", {
    export: {
      prepareHtmlPreview: preparePreview,
      beginClipboardCopy: beginCopy,
      copyFullText: finishCopy,
      copyHTMLToClipboard: finishWechatCopy,
      confirmClipboardCopy: confirmCopy,
      onClipboardCopySuperseded: (callback: (requestId: number) => void) => {
        notifySuperseded = callback;
        return () => {
          notifySuperseded = undefined;
        };
      }
    },
    workspace: { beginSwitch }
  });
  buildDocument.mockReset();
  buildDocument.mockResolvedValue("<p>Export Preview</p>");
  preparePreview.mockReset();
  preparePreview.mockResolvedValue({ ok: true, value: "<p>Export Preview</p>" });
  renderMarkdown.mockReset();
  renderMarkdown.mockResolvedValue('<img src="http://example.invalid/figure.png" alt="Figure">');
  beginCopy.mockReset().mockResolvedValue({ ok: true, value: 7 });
  finishCopy.mockReset().mockResolvedValue({ ok: true });
  finishWechatCopy.mockReset().mockResolvedValue({ ok: true });
  confirmCopy.mockReset().mockResolvedValue({ ok: true });
  beginSwitch.mockReset().mockResolvedValue({ ok: true });
  buildClipboard.mockReset();
  buildWechatClipboard.mockReset();
  noteSelection.id = "first-note";
  locale = createInstance();
  await locale.init({
    lng: "en",
    fallbackLng: false,
    showSupportNotice: false,
    resources: { en: { editor: enEditor, note: enNote }, zh: { editor: zhEditor } }
  });
  useViewStore.setState(useViewStore.getInitialState());
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("prepares Export Preview only while visible and cancels a pending render before IPC", async () => {
  vi.useFakeTimers();
  const renderContent = (content: string) => render(createElement(PreviewContent, { content }));
  const setMode = (mode: "edit" | "exportPreview") => act(() => useViewStore.getState().setExclusiveMode(mode));
  const debounce = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

  await renderContent("first");
  await setMode("exportPreview");
  await debounce();
  expect(preparePreview).toHaveBeenCalledTimes(1);

  await setMode("edit");
  await renderContent("edited while hidden");
  await debounce();
  expect(buildDocument).toHaveBeenCalledTimes(1);

  let finishRender: (html: string) => void = () => {};
  buildDocument.mockReturnValueOnce(
    new Promise<string>((resolve) => {
      finishRender = resolve;
    })
  );
  await setMode("exportPreview");
  await debounce();
  expect(buildDocument).toHaveBeenCalledTimes(2);
  await setMode("edit");
  await act(() => finishRender("<p>Stale HTML</p>"));
  expect(preparePreview).toHaveBeenCalledTimes(1);
});

it("shows a disabled Copy Full Text command after switching notes during a copy", async () => {
  let finishCopy: () => void = () => {};
  const copy = vi
    .fn()
    .mockResolvedValue(undefined)
    .mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishCopy = resolve;
      })
    );
  const renderToolbar = () => render(createElement(EditorToolbar, { onCopyFullText: copy }));
  const openMore = () =>
    act(() => {
      window.dispatchEvent(new Event("app:toggle-more-menu"));
    });
  const findCopyButton = (label: string) =>
    [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === label);

  await renderToolbar();
  await openMore();
  expect(findCopyButton(enEditor.toolbar.copyFullText)?.disabled).toBe(false);
  await act(() => findCopyButton(enEditor.toolbar.copyFullText)!.click());

  noteSelection.id = "second-note";
  await renderToolbar();
  await openMore();
  const busyButton = findCopyButton(enEditor.toolbar.copyingFullText);
  expect(busyButton?.disabled).toBe(true);
  await act(() => busyButton!.click());
  expect(copy).toHaveBeenCalledExactlyOnceWith("first-note");

  await act(() => finishCopy());
  const readyButton = findCopyButton(enEditor.toolbar.copyFullText);
  expect(readyButton?.disabled).toBe(false);
  await act(() => readyButton!.click());
  expect(copy).toHaveBeenNthCalledWith(2, "second-note");
});

it.each([false, true])("reserves a WeChat request before rendering (workspace changes=%s)", async (switchWorkspace) => {
  const workspacePath = "/notes/workspace";
  const note = { id: "one", title: "Source", content: "Text", filePath: `${workspacePath}/note.md` };
  useWorkspaceStore.setState({ workspacePath, revision: 3 });
  let finishRender: (html: string) => void = () => {};
  buildWechatClipboard.mockImplementationOnce(() => {
    expect(beginCopy).toHaveBeenCalledExactlyOnceWith(workspacePath, note.filePath);
    return new Promise<string>((resolve) => {
      finishRender = resolve;
    });
  });
  let copy: UseNoteExportReturn["copyToWechat"] | undefined;
  function CopyFixture() {
    copy = useNoteExport().copyToWechat;
    return null;
  }
  await render(createElement(CopyFixture));
  const copying = copy!(note);
  await vi.waitFor(() => expect(buildWechatClipboard).toHaveBeenCalledOnce());
  expect(finishWechatCopy).not.toHaveBeenCalled();
  if (switchWorkspace) useWorkspaceStore.setState({ revision: 4 });
  finishRender("<p>For WeChat</p>");
  await copying;

  if (switchWorkspace) expect(finishWechatCopy).not.toHaveBeenCalled();
  else expect(finishWechatCopy).toHaveBeenCalledExactlyOnceWith(7, "<p>For WeChat</p>", "zh");
});

it.each([
  ["copyFullText", true],
  ["copyToWechat", true],
  ["copyFullText", false]
] as const)("waits for an in-window %s action (workspace unchanged=%s)", async (command, confirm) => {
  vi.useFakeTimers();
  const workspacePath = "/notes/workspace";
  const note = { id: "one", title: "Source", content: "Text", filePath: `${workspacePath}/note.md` };
  useWorkspaceStore.setState({ workspacePath, revision: 3 });
  buildClipboard.mockResolvedValueOnce("<p>Text</p>");
  buildWechatClipboard.mockResolvedValueOnce("<p>Text</p>");
  (command === "copyFullText" ? finishCopy : finishWechatCopy).mockResolvedValueOnce({
    ok: true,
    value: "confirmation-required"
  });
  let copy: UseNoteExportReturn[typeof command] | undefined;
  function CopyFixture() {
    copy = useNoteExport()[command];
    return createElement(Toaster, { theme: "light" });
  }
  await render(createElement(CopyFixture));
  let copying: Promise<void> | undefined;
  await act(async () => {
    copying = copy!(note);
  });
  await act(() => vi.advanceTimersByTimeAsync(40));

  const action = container.querySelector<HTMLButtonElement>("button[data-action]");
  expect(action?.textContent).toBe(enNote.export.clipboardCopyNow);
  expect(confirmCopy).not.toHaveBeenCalled();
  expect(container.querySelector('[data-type="success"]')).toBeNull();
  await act(async () => {
    if (confirm) action!.click();
    else useWorkspaceStore.setState({ revision: 4 });
    await copying;
  });
  await act(() => vi.advanceTimersByTimeAsync(40));
  expect(confirmCopy).toHaveBeenCalledExactlyOnceWith(7, confirm);
  expect(container.querySelector('[data-type="success"]') !== null).toBe(confirm);
});

it.each([false, true])("releases a superseded clipboard copy (notification before prompt=%s)", async (beforePrompt) => {
  vi.useFakeTimers();
  const workspacePath = "/notes/workspace";
  const note = { id: "one", title: "Source", content: "Text", filePath: `${workspacePath}/note.md` };
  useWorkspaceStore.setState({ workspacePath, revision: 3 });
  buildClipboard.mockResolvedValue("<p>Text</p>");
  let finishPreparation: () => void = () => {};
  finishCopy.mockReturnValueOnce(
    new Promise((resolve) => {
      finishPreparation = () => resolve({ ok: true, value: "confirmation-required" });
    })
  );
  let copy: UseNoteExportReturn["copyFullText"] | undefined;
  function CopyFixture() {
    copy = useNoteExport().copyFullText;
    return createElement(Toaster, { theme: "light" });
  }
  await render(createElement(CopyFixture));
  const finished = vi.fn();
  await act(async () => {
    void copy!(note).then(finished);
  });
  expect(finishCopy).toHaveBeenCalledOnce();
  if (beforePrompt) {
    await act(async () => {
      notifySuperseded!(7);
      finishPreparation();
    });
  } else {
    await act(() => finishPreparation());
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(container.querySelector("button[data-action]")?.textContent).toBe(enNote.export.clipboardCopyNow);
    await act(() => notifySuperseded!(6));
    expect(finished).not.toHaveBeenCalled();
    await act(() => notifySuperseded!(7));
  }

  await act(() => vi.advanceTimersByTimeAsync(40));
  await act(() => vi.advanceTimersByTimeAsync(250));
  expect(finished).toHaveBeenCalledOnce();
  expect(container.querySelector("button[data-action]")).toBeNull();
  expect(container.querySelector('[data-type="success"]')).toBeNull();
  expect(confirmCopy).not.toHaveBeenCalled();

  beginCopy.mockResolvedValueOnce({ ok: true, value: 8 });
  await act(async () => {
    await copy!(note);
  });
  expect(finishCopy).toHaveBeenNthCalledWith(2, 8, note.content, "<p>Text</p>", "zh");
});

it.each([false, true])(
  "checks the source workspace revision after rendering (return to source=%s)",
  async (returnToSource) => {
    const workspacePath = "/notes/workspace";
    const note = { id: "one", title: "Source", content: "Text", filePath: `${workspacePath}/note.md` };
    useWorkspaceStore.setState({ workspacePath, revision: 3 });
    const revisionsAtNotification: number[] = [];
    beginSwitch.mockImplementation(async () => {
      revisionsAtNotification.push(useWorkspaceStore.getState().revision);
      return { ok: true };
    });
    let finishRender: (html: string) => void = () => {};
    buildClipboard.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        finishRender = resolve;
      })
    );
    let copy: UseNoteExportReturn["copyFullText"] | undefined;
    function CopyFixture() {
      copy = useNoteExport().copyFullText;
      return null;
    }
    await render(createElement(CopyFixture));
    let copying: Promise<void> | undefined;
    await act(async () => {
      copying = copy!(note);
    });
    expect(beginCopy).toHaveBeenCalledExactlyOnceWith(workspacePath, note.filePath);
    expect(buildClipboard).toHaveBeenCalledOnce();

    await act(async () => {
      const store = useWorkspaceStore.getState();
      await store.setWorkspacePath("/notes");
      if (returnToSource) await store.setWorkspacePath(workspacePath);
      store.setLoading(false);
      finishRender("<p>Text</p>");
      await copying;
    });
    expect(beginSwitch).toHaveBeenNthCalledWith(1, "/notes");
    expect(revisionsAtNotification).toEqual(returnToSource ? [3, 4] : [3]);
    expect(finishCopy).not.toHaveBeenCalled();
  }
);

it("explains the HTTPS requirement when the presentation renderer has no note ID", async () => {
  await render(createElement(MarkdownRenderer, { content: "image" }));
  expect(container.textContent).toContain(`Figure (${enEditor.errors.httpImage})`);
  expect(container.querySelector("img")).toBeNull();
});

it("updates existing HTTP image warnings on language changes without rebuilding the note", async () => {
  renderMarkdown.mockResolvedValueOnce(
    '<p><img src="http://example.invalid/figure.png" alt="Figure"></p><p><img src="http://example.invalid/unnamed.png"></p><video></video>'
  );
  await render(createElement(MarkdownRenderer, { content: "image" }));
  const video = container.querySelector("video");
  expect(video).toBeInstanceOf(HTMLVideoElement);
  expect([...container.querySelectorAll("p")].map((item) => item.textContent)).toEqual([
    `Figure (${enEditor.errors.httpImage})`,
    enEditor.errors.httpImage
  ]);

  await act(async () => {
    await locale.changeLanguage("zh");
  });

  expect([...container.querySelectorAll("p")].map((item) => item.textContent)).toEqual([
    `Figure (${zhEditor.errors.httpImage})`,
    zhEditor.errors.httpImage
  ]);
  expect(container.querySelector("video")).toBe(video);
  expect(renderMarkdown).toHaveBeenCalledOnce();
});
