import { beforeEach, describe, expect, it, vi } from "vitest";

const { folderRenameMock, workspaceState } = vi.hoisted(() => ({
  folderRenameMock: vi.fn(),
  workspaceState: { workspacePath: "/workspace" }
}));

vi.mock("@/ipc", () => ({
  folderIpc: { rename: folderRenameMock },
  configIpc: { setPinnedNotes: vi.fn() },
  watcherIpc: { pause: vi.fn(), resume: vi.fn() }
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspaceState }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store", () => ({
  useNoteStore: {
    getState: () => ({ notes: [], selectedNoteId: null }),
    setState: vi.fn()
  }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearDebouncedSave: vi.fn(),
  flushAllDebouncedSaves: vi.fn(),
  setLastSavedContent: vi.fn()
}));

import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";

describe("folder rename paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    folderRenameMock.mockResolvedValue(undefined);
    workspaceState.workspacePath = "/workspace";
    useFolderStore.setState({ folders: [], selectedFolderId: null });
  });

  it.each([
    { workspace: "/workspace", separator: "/" },
    { workspace: "C:\\workspace", separator: "\\" }
  ])("updates the renamed folder and descendants in $workspace", async ({ workspace, separator }) => {
    workspaceState.workspacePath = workspace;
    useFolderStore.setState({
      folders: [
        { id: "a", name: "a", path: `${workspace}${separator}a` },
        { id: "a/child", name: "a/child", path: `${workspace}${separator}a${separator}child` },
        { id: "another", name: "another", path: `${workspace}${separator}another` }
      ],
      selectedFolderId: "a/child"
    });

    await useFolderStore.getState().renameFolder("a", "b");

    expect(useFolderStore.getState().folders).toMatchObject([
      { id: "b", name: "b", path: `${workspace}${separator}b` },
      { id: "b/child", name: "b/child", path: `${workspace}${separator}b${separator}child` },
      { id: "another", name: "another", path: `${workspace}${separator}another` }
    ]);
    expect(useFolderStore.getState().selectedFolderId).toBe("b/child");
  });

  it("uses the new path for a second rename", async () => {
    useFolderStore.setState({
      folders: [{ id: "a", name: "a", path: "/workspace/a" }]
    });

    await useFolderStore.getState().renameFolder("a", "b");
    await useFolderStore.getState().renameFolder("b", "c");

    expect(folderRenameMock).toHaveBeenNthCalledWith(1, "/workspace/a", "/workspace/b");
    expect(folderRenameMock).toHaveBeenNthCalledWith(2, "/workspace/b", "/workspace/c");
    expect(useFolderStore.getState().folders[0]).toMatchObject({
      id: "c",
      name: "c",
      path: "/workspace/c"
    });
  });
});
