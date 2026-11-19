import { createRequire } from "node:module";
import { expect, it, vi } from "vitest";

const requireFromDesktop = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const { JSDOM } = requireFromDesktop("jsdom") as typeof import("jsdom");

vi.mock("@/ipc", () => ({
  configIpc: {},
  themeIpc: {},
  fileIpc: {},
  folderIpc: {},
  watcherIpc: {},
  workspaceIpc: {},
  githubIpc: {}
}));

it("navigates actual grouped search results with the keyboard", async () => {
  const dom = new JSDOM("<button>Previous</button><div id='root'></div>", { pretendToBeVisual: true });
  const browser = dom.window;
  for (const key of [
    "window",
    "document",
    "navigator",
    "Element",
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
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  await import("@/lib/i18n");
  const { useFolderStore, useNoteStore, useWorkspaceStore } = await import("@/stores");
  useWorkspaceStore.setState({ workspacePath: "/foo", isLoading: false, revision: 1 });
  useFolderStore.setState({ folders: [{ id: "foo/Test", name: "foo/Test" }] });
  useNoteStore.setState({
    notes: [
      { id: "bar/Test.md", title: "Test", fileName: "Test.md", content: "" },
      { id: "spec.md", title: "spec", fileName: "spec.md", content: "" }
    ]
  });
  const { WorkspaceSearch } = await import("@/components/app/workspace-search");
  const root = createRoot(browser.document.getElementById("root")!);
  const folder = vi.fn();
  const file = vi.fn();
  const render = async (focusRequest = 0) =>
    await act(() =>
      root.render(createElement(WorkspaceSearch, { onSelectFolder: folder, onSelectNote: file, focusRequest }))
    );

  try {
    await render();
    const previous = browser.document.querySelector("button")!;
    previous.focus();
    await render(1);
    const input = browser.document.querySelector("input")!;
    expect(browser.document.activeElement).toBe(input);

    const setValue = Object.getOwnPropertyDescriptor(browser.HTMLInputElement.prototype, "value")!.set!;
    const type = async (text: string) =>
      await act(() => {
        setValue.call(input, text);
        input.dispatchEvent(new browser.Event("input", { bubbles: true }));
      });
    const press = async (key: string, isComposing = false) =>
      await act(() => {
        input.dispatchEvent(
          new browser.KeyboardEvent("keydown", { key, isComposing, bubbles: true, cancelable: true })
        );
      });
    const activeTitle = () =>
      browser.document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.getAttribute("title");

    await type("test");
    expect([...browser.document.querySelectorAll("[role=option]")].map((item) => item.textContent)).toEqual([
      "Testfoo/Test",
      "Test.mdbar/Test.md"
    ]);
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    await press("Enter", true);
    expect(folder).not.toHaveBeenCalled();
    await press("ArrowDown");
    await press("Enter");
    expect(folder).not.toHaveBeenCalled();
    expect(file).toHaveBeenCalledWith("bar/Test.md");
    expect(input.value).toBe("");
    await type("foo\\test");
    expect([...browser.document.querySelectorAll("[role=option]")].map((item) => item.textContent)).toEqual([
      "Testfoo/Test"
    ]);
    await press("Enter");
    expect(folder).toHaveBeenCalledWith("foo/Test");

    await act(() => {
      useFolderStore.setState({
        folders: [
          { id: "bar/Test.md-backup", name: "bar/Test.md-backup" },
          { id: "archive/spec.md-backup", name: "archive/spec.md-backup" },
          { id: "reports/weekly", name: "reports/weekly" },
          { id: "reports", name: "reports" }
        ]
      });
    });
    await type("bar/Test.m");
    expect(browser.document.querySelector("[role=option]")?.getAttribute("title")).toBe("bar/Test.md-backup");
    await type("bar/Test.md");
    expect([...browser.document.querySelectorAll("[role=option]")].map((item) => item.getAttribute("title"))).toEqual([
      "bar/Test.md",
      "bar/Test.md-backup"
    ]);
    await press("Enter");
    expect(file).toHaveBeenCalledTimes(2);
    expect(file).toHaveBeenLastCalledWith("bar/Test.md");

    await type("bar\\Test.md");
    await press("ArrowDown");
    await press("Enter");
    expect(folder).toHaveBeenLastCalledWith("bar/Test.md-backup");

    await type("spec.md");
    expect(activeTitle()).toBe("archive/spec.md-backup");
    await type("./spec.md");
    expect(activeTitle()).toBe("spec.md");
    await press("Enter");
    expect(file).toHaveBeenLastCalledWith("spec.md");

    await type("reports/");
    expect(activeTitle()).toBe("reports");
    await press("Enter");
    expect(folder).toHaveBeenLastCalledWith("reports");

    await type("missing");
    expect(browser.document.querySelector("[role=status]")?.textContent).toBe("没有匹配的文件夹或文件");
    await press("Escape");
    expect(browser.document.activeElement).toBe(previous);
  } finally {
    await act(() => root.unmount());
    browser.close();
    vi.unstubAllGlobals();
  }
}, 15_000);
