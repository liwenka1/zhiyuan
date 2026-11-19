// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import "@/lib/i18n";
import { useViewStore } from "@/stores/use-view-store";
import { FolderTree } from "@/features/note-workspace/components/folder-tree";

it("reveals and focuses the selected folder on each search request", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
  const search = document.body.appendChild(document.createElement("input"));
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const previousView = useViewStore.getState();

  try {
    search.focus();
    useViewStore.setState({ showFolderSidebar: true, folderRevealRequest: 0 });
    await act(() =>
      root.render(
        createElement(FolderTree, {
          settingsButton: null,
          folders: [{ id: "reports", name: "Reports" }],
          selectedFolderId: "reports"
        })
      )
    );
    const selectedFolder = container.querySelector("[data-selected-folder]");
    expect(selectedFolder?.textContent).toContain("Reports");
    expect(document.activeElement).toBe(search);
    scrollIntoView.mockClear();

    await act(() => useViewStore.getState().revealFolderSidebar());
    expect(document.activeElement).toBe(selectedFolder);
    search.focus();
    await act(() => useViewStore.getState().revealFolderSidebar());
    expect(document.activeElement).toBe(selectedFolder);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts).toEqual([selectedFolder, selectedFolder]);
    expect(useViewStore.getState().showFolderSidebar).toBe(true);

    await act(() => useViewStore.getState().setShowFolderSidebar(false));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    search.focus();
    await act(() => useViewStore.getState().revealFolderSidebar());
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(useViewStore.getState().showFolderSidebar).toBe(true);
    expect(document.activeElement).toBe(selectedFolder);
  } finally {
    await act(() => root.unmount());
    container.remove();
    search.remove();
    useViewStore.setState(previousView);
    if (original) Object.defineProperty(Element.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    vi.unstubAllGlobals();
  }
});
