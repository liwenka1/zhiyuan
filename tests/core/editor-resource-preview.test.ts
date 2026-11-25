// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createInstance, type i18n } from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewContent } from "@/features/editor/components/preview-content";
import { MarkdownRenderer } from "@/features/editor/components/markdown-renderer";
import { useViewStore } from "@/stores/use-view-store";
import enEditor from "@/locales/en/editor.json";
import zhEditor from "@/locales/zh/editor.json";

const { buildDocument, preparePreview, renderMarkdown } = vi.hoisted(() => ({
  buildDocument: vi.fn(),
  preparePreview: vi.fn(),
  renderMarkdown: vi.fn()
}));

vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/features/export/lib", async () => import("@/features/export/lib/export-preview-html"));
vi.mock("@/features/export/lib/export-pipeline", () => ({ buildExportDocumentFromMarkdown: buildDocument }));
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
  useNoteStore: {},
  useThemeStore: (select: (state: { theme: string }) => string) => select({ theme: "light" })
}));

let container: HTMLDivElement;
let root: Root;
let locale: i18n;

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
  vi.stubGlobal("api", { export: { prepareHtmlPreview: preparePreview } });
  buildDocument.mockReset();
  buildDocument.mockResolvedValue("<p>Export Preview</p>");
  preparePreview.mockReset();
  preparePreview.mockResolvedValue({ ok: true, value: "<p>Export Preview</p>" });
  renderMarkdown.mockReset();
  renderMarkdown.mockResolvedValue('<img src="http://example.invalid/figure.png" alt="Figure">');
  locale = createInstance();
  await locale.init({
    lng: "en",
    fallbackLng: false,
    showSupportNotice: false,
    resources: { en: { editor: enEditor }, zh: { editor: zhEditor } }
  });
  useViewStore.setState(useViewStore.getInitialState());
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
