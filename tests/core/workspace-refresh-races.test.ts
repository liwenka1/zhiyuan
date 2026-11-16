import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  workspaceState,
  scanMock,
  loadMock,
  foldersMock,
  pinsMock,
  rssUpdateMock,
  rssImportMock,
  urlImportMock,
  unsubscribeMock,
  folderDeleteMock,
  flushMock,
  selectNoteMock,
  dismissMock
} = vi.hoisted(() => ({
  workspaceState: { workspacePath: "/workspace-a" },
  scanMock: vi.fn(),
  loadMock: vi.fn(),
  foldersMock: vi.fn(),
  pinsMock: vi.fn(),
  rssUpdateMock: vi.fn(),
  rssImportMock: vi.fn(),
  urlImportMock: vi.fn(),
  unsubscribeMock: vi.fn(),
  folderDeleteMock: vi.fn(),
  flushMock: vi.fn(),
  selectNoteMock: vi.fn(),
  dismissMock: vi.fn()
}));

vi.mock("@/stores", () => {
  const noteState = {
    notes: [],
    loadFromFileSystem: loadMock,
    selectNote: selectNoteMock,
    createNote: vi.fn(),
    renameNote: vi.fn()
  };
  const folderState = {
    folders: [],
    selectedFolderId: null,
    setFolders: foldersMock,
    selectFolder: vi.fn(),
    createFolder: vi.fn(),
    renameFolder: vi.fn()
  };
  return {
    useWorkspaceStore: Object.assign((select: (state: typeof workspaceState) => unknown) => select(workspaceState), {
      getState: () => workspaceState
    }),
    useNoteStore: Object.assign((select: (state: typeof noteState) => unknown) => select(noteState), {
      getState: () => noteState
    }),
    useFolderStore: Object.assign((select: (state: typeof folderState) => unknown) => select(folderState), {
      getState: () => folderState
    })
  };
});
vi.mock("@/stores/note-store/loaders", () => ({ captureNoteLoadSnapshot: () => new Map() }));
vi.mock("@/stores/note-store/persistence", () => ({ flushAllDebouncedSaves: flushMock }));
vi.mock("@/ipc", () => ({
  workspaceIpc: { scan: scanMock },
  watcherIpc: { pause: vi.fn(), resume: vi.fn() },
  rssIpc: { update: rssUpdateMock, import: rssImportMock, unsubscribe: unsubscribeMock },
  urlIpc: { createNote: urlImportMock },
  folderIpc: { delete: folderDeleteMock },
  shellIpc: {},
  configIpc: { setPinnedNotes: pinsMock }
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: dismissMock }
}));
vi.mock("@/components/input-dialog", () => ({ InputDialog: () => null }));

import { useFolderHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-folder-handlers";
import { NoteDialogs } from "../../apps/desktop/src/renderer/src/features/note-workspace/components/note-dialogs";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => (resolve = finish));
  return { promise, resolve };
}

function folderHandlers() {
  return useFolderHandlers({
    onOpenCreateDialog: vi.fn(),
    onOpenRssImportDialog: vi.fn(),
    onOpenRenameDialog: vi.fn()
  });
}

function importDialog(type: "rss" | "url") {
  const noop = vi.fn();
  const element = NoteDialogs({
    showCreateFolderDialog: false,
    onCloseCreateFolderDialog: noop,
    showCreateNoteDialog: false,
    onCloseCreateNoteDialog: noop,
    showRssImportDialog: true,
    onCloseRssImportDialog: noop,
    showUrlCreateDialog: true,
    onCloseUrlCreateDialog: noop,
    showRenameNoteDialog: false,
    noteToRename: null,
    onCloseRenameNoteDialog: noop,
    showRenameFolderDialog: false,
    folderToRename: null,
    onCloseRenameFolderDialog: noop
  }) as ReactElement<{ children: Array<ReactElement<{ title: string; onConfirm: (url: string) => Promise<void> }>> }>;
  const title = type === "rss" ? "dialog.importRss.title" : "dialog.createFromUrl.title";
  return element.props.children.find((child) => child.props.title === title)!.props.onConfirm;
}

const folder = { id: "rss", name: "rss", path: "/workspace-a/rss", isRss: true };
const scanData = { folders: [{ id: "rss", name: "rss", path: "/workspace-a/rss", noteCount: 1 }], notes: [] };

describe("workspace refresh operation ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    workspaceState.workspacePath = "/workspace-a";
    flushMock.mockResolvedValue(undefined);
    rssUpdateMock.mockResolvedValue({ addedCount: 1 });
    scanMock.mockResolvedValue(scanData);
    loadMock.mockResolvedValue(undefined);
    vi.stubGlobal("window", { confirm: () => true });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("still refreshes folders, notes, and pins for the current workspace", async () => {
    await folderHandlers().handleUpdateRss(folder);

    expect(scanMock).toHaveBeenCalledWith("/workspace-a");
    expect(foldersMock).toHaveBeenCalledWith(scanData.folders);
    expect(loadMock).toHaveBeenCalledWith(scanData, "/workspace-a", expect.any(Map));
    expect(pinsMock).toHaveBeenCalledWith("/workspace-a", []);
  });

  it("does not scan the old workspace when an RSS update finishes after a workspace switch", async () => {
    const update = deferred<{ addedCount: number }>();
    rssUpdateMock.mockReturnValue(update.promise);
    const operation = folderHandlers().handleUpdateRss(folder);
    await vi.waitFor(() => expect(rssUpdateMock).toHaveBeenCalledOnce());
    workspaceState.workspacePath = "/workspace-b";
    update.resolve({ addedCount: 1 });
    await operation;

    expect(scanMock).not.toHaveBeenCalled();
    expect(foldersMock).not.toHaveBeenCalled();
  });

  it("does not replace folders when a scan finishes after a workspace switch", async () => {
    const scan = deferred<typeof scanData>();
    scanMock.mockReturnValue(scan.promise);
    const operation = folderHandlers().handleUpdateRss(folder);
    await vi.waitFor(() => expect(scanMock).toHaveBeenCalledOnce());
    workspaceState.workspacePath = "/workspace-b";
    scan.resolve(scanData);
    await operation;

    expect(foldersMock).not.toHaveBeenCalled();
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("does not write pin configuration for the new workspace after a late load", async () => {
    const loading = deferred<void>();
    loadMock.mockReturnValue(loading.promise);
    const operation = folderHandlers().handleUpdateRss(folder);
    await vi.waitFor(() => expect(loadMock).toHaveBeenCalledOnce());
    workspaceState.workspacePath = "/workspace-b";
    loading.resolve();
    await operation;

    expect(pinsMock).not.toHaveBeenCalled();
  });

  it("does not delete an old folder after switching workspaces during save flushing", async () => {
    const flushing = deferred<void>();
    flushMock.mockReturnValue(flushing.promise);
    const operation = folderHandlers().handleDeleteFolder(folder);
    workspaceState.workspacePath = "/workspace-b";
    flushing.resolve();
    await operation;

    expect(folderDeleteMock).not.toHaveBeenCalled();
    expect(scanMock).not.toHaveBeenCalled();
  });

  it("does not overwrite the new workspace folders after a late RSS unsubscribe", async () => {
    const unsubscribing = deferred<void>();
    unsubscribeMock.mockReturnValue(unsubscribing.promise);
    const operation = folderHandlers().handleUnsubscribeRss(folder);
    workspaceState.workspacePath = "/workspace-b";
    unsubscribing.resolve();
    await operation;

    expect(foldersMock).not.toHaveBeenCalled();
  });

  it.each(["rss", "url"] as const)("does not refresh the old workspace after a late %s import", async (type) => {
    const importing = deferred<unknown>();
    const importer = type === "rss" ? rssImportMock : urlImportMock;
    importer.mockReturnValue(importing.promise);
    const operation = importDialog(type)("https://example.com");
    await vi.waitFor(() => expect(importer).toHaveBeenCalledOnce());
    workspaceState.workspacePath = "/workspace-b";
    importing.resolve({ folderName: "rss", noteId: "note.md" });
    await operation;

    expect(scanMock).not.toHaveBeenCalled();
    expect(foldersMock).not.toHaveBeenCalled();
    expect(selectNoteMock).not.toHaveBeenCalled();
    expect(dismissMock).toHaveBeenCalled();
  });
});
