import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const {
  harness,
  scanMock,
  writeMock,
  createMock,
  renameMock,
  deleteMock,
  copyMock,
  folderCreateMock,
  folderRenameMock,
  folderDeleteMock,
  pauseMock,
  resumeMock,
  formatMock,
  pinsMock,
  errorMock
} = vi.hoisted(() => ({
  harness: {
    state: null as unknown as NoteStore,
    effects: [] as Array<() => unknown>,
    refs: [] as unknown[],
    refIndex: 0
  },
  scanMock: vi.fn(),
  writeMock: vi.fn(),
  createMock: vi.fn(),
  renameMock: vi.fn(),
  deleteMock: vi.fn(),
  copyMock: vi.fn(),
  folderCreateMock: vi.fn(),
  folderRenameMock: vi.fn(),
  folderDeleteMock: vi.fn(),
  pauseMock: vi.fn(),
  resumeMock: vi.fn(),
  formatMock: vi.fn(),
  pinsMock: vi.fn(),
  errorMock: vi.fn()
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: () => unknown) => harness.effects.push(effect),
  useRef: (value: unknown) => {
    const index = harness.refIndex++;
    harness.refs[index] ??= { current: value };
    return harness.refs[index];
  }
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { error: errorMock, loading: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: formatMock }));
vi.mock("@/features/export", () => ({ useNoteExport: () => ({ exportNote: vi.fn(), copyToWechat: vi.fn() }) }));
vi.mock("@/ipc", () => ({
  workspaceIpc: { scan: scanMock },
  fileIpc: { write: writeMock, create: createMock, rename: renameMock, delete: deleteMock, copy: copyMock },
  folderIpc: { create: folderCreateMock, rename: folderRenameMock, delete: folderDeleteMock },
  watcherIpc: { pause: pauseMock, resume: resumeMock },
  configIpc: { getPinnedNotes: vi.fn().mockResolvedValue([]), setPinnedNotes: pinsMock },
  shellIpc: {},
  githubIpc: {},
  rssIpc: {}
}));
vi.mock("@/stores/note-store", () => ({
  useNoteStore: Object.assign((select: (state: NoteStore) => unknown) => select(harness.state), {
    getState: () => harness.state,
    setState: (update: ((state: NoteStore) => Partial<NoteStore>) | Partial<NoteStore>) => {
      Object.assign(harness.state, typeof update === "function" ? update(harness.state) : update);
    }
  })
}));
vi.mock("@/stores", async () => {
  const { useWorkspaceStore } = await import("../../apps/desktop/src/renderer/src/stores/use-workspace-store");
  const { useFolderStore } = await import("../../apps/desktop/src/renderer/src/stores/use-folder-store");
  const { useNoteStore } = await import("@/stores/note-store");
  return {
    useNoteStore,
    useWorkspaceStore: Object.assign(
      (select: (state: ReturnType<typeof useWorkspaceStore.getState>) => unknown) =>
        select(useWorkspaceStore.getState()),
      { getState: useWorkspaceStore.getState }
    ),
    useFolderStore: Object.assign(
      (select: (state: ReturnType<typeof useFolderStore.getState>) => unknown) => select(useFolderStore.getState()),
      { getState: useFolderStore.getState }
    ),
    useGitHubSettingsStore: { getState: vi.fn() }
  };
});

import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import { createLoaders } from "../../apps/desktop/src/renderer/src/stores/note-store/loaders";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  hasPendingSave
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";
import { useWorkspaceInit } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-workspace-init";
import { useNoteHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-note-handlers";
import { useFolderHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-folder-handlers";

const rootA = "/workspace-a";
const rootB = "/workspace-b";
const folder = { id: "folder", name: "folder", path: `${rootA}/folder` };
const savedFiles = new Map<string, string>();

function scanData(root: string) {
  return {
    folders: [{ ...folder, path: `${root}/folder` }],
    notes: [
      {
        id: "note.md",
        title: "note",
        fileName: "note.md",
        filePath: `${root}/note.md`,
        content: savedFiles.get(`${root}/note.md`) ?? `${root} disk`
      }
    ]
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((finish, fail) => {
    resolve = finish;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function settle() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}

function renderWorkspaceLoad() {
  harness.effects = [];
  harness.refIndex = 0;
  useWorkspaceInit();
  harness.effects[0]();
}

async function openA() {
  useWorkspaceStore.getState().setWorkspacePath(rootA);
  renderWorkspaceLoad();
  await settle();
  expect(useWorkspaceStore.getState().isLoading).toBe(false);
  harness.state.selectNote("note.md");
}

function beginSwitch() {
  const scan = deferred<ReturnType<typeof scanData> | null>();
  scanMock.mockReturnValueOnce(scan.promise);
  useWorkspaceStore.getState().setWorkspacePath(rootB);
  renderWorkspaceLoad();
  return scan;
}

function noteHandlers() {
  return useNoteHandlers({ onOpenRenameDialog: vi.fn(), onOpenCreateNoteDialog: vi.fn() });
}

function folderHandlers() {
  return useFolderHandlers({
    onOpenCreateDialog: vi.fn(),
    onOpenRssImportDialog: vi.fn(),
    onOpenRenameDialog: vi.fn()
  });
}

type OldOperation = "create" | "rename" | "move" | "create-folder" | "rename-folder" | "delete-folder" | "rss-update";

function startOldOperation(kind: OldOperation) {
  switch (kind) {
    case "create":
      return harness.state.createNote(undefined, "new");
    case "rename":
      return harness.state.renameNote("note.md", "renamed");
    case "move":
      return harness.state.moveNote("note.md", "folder");
    case "create-folder":
      return useFolderStore.getState().createFolder("new-folder");
    case "rename-folder":
      return useFolderStore.getState().renameFolder("folder", "renamed-folder");
    case "delete-folder":
      return folderHandlers().handleDeleteFolder(folder);
    case "rss-update":
      return folderHandlers().handleUpdateRss({ ...folder, isRss: true });
  }
}

describe("workspace switching edit isolation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    savedFiles.clear();
    harness.refs = [];
    harness.refIndex = 0;
    useWorkspaceStore.setState({ workspacePath: null, pendingFilePath: null, isLoading: false });
    useFolderStore.setState({ folders: [], selectedFolderId: null });
    harness.state = {
      notes: [] as Note[],
      selectedNoteId: null,
      editorContent: "",
      openNoteIds: [],
      playingNoteIds: [],
      savingNoteIds: new Set(),
      isLoadingFromFileSystem: false,
      searchKeyword: ""
    } as unknown as NoteStore;
    const get = () => harness.state;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(harness.state);
      else Object.assign(harness.state, update);
    };
    Object.assign(harness.state, createNoteActions(set, get), applyPersistence(set, get), createLoaders(set, get));
    scanMock.mockImplementation(async (root: string) => scanData(root));
    writeMock.mockImplementation(async (filePath: string, content: string) => {
      savedFiles.set(filePath, content);
    });
    pauseMock.mockResolvedValue(undefined);
    formatMock.mockResolvedValue("formatted");
    vi.stubGlobal("window", { confirm: () => true, setTimeout });
  });

  afterEach(() => {
    clearAllDebouncedSaves();
    clearPendingSave("note.md");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("blocks the old editor and note operations after the old draft was flushed but before the new root is bound", async () => {
    await openA();
    const oldEditorOnChange = harness.state.updateNoteContent;
    const oldNoteHandlers = noteHandlers();
    const oldFolderHandlers = folderHandlers();
    oldEditorOnChange("draft before switching");
    const scan = deferred<ReturnType<typeof scanData> | null>();
    scanMock.mockReturnValueOnce(scan.promise);
    useWorkspaceStore.getState().setWorkspacePath(rootB);
    // The old editor callback can fire before React commits the loading screen.
    oldEditorOnChange("input before rerender");
    renderWorkspaceLoad();
    await settle();
    expect(scanMock).toHaveBeenLastCalledWith(rootB);
    expect(writeMock).toHaveBeenCalledWith(`${rootA}/note.md`, "draft before switching");
    expect(hasPendingSave(`${rootA}/note.md`)).toBe(false);
    expect(harness.state.notes[0].filePath).toBe(`${rootA}/note.md`);

    // This was the loss window: scan is pending, the prior flush is finished, and A is still the displayed note.
    oldEditorOnChange("late old-editor input");
    harness.state.updateNoteContentById("note.md", "late background-editor input");
    await Promise.all([
      harness.state.createNote(undefined, "new"),
      harness.state.renameNote("note.md", "renamed"),
      harness.state.duplicateNote("note.md"),
      harness.state.moveNote("note.md", "folder"),
      harness.state.formatCurrentNote(),
      harness.state.togglePinNote("note.md"),
      oldNoteHandlers.handleDeleteNote(harness.state.notes[0]),
      useFolderStore.getState().createFolder("new-folder"),
      useFolderStore.getState().renameFolder("folder", "renamed-folder"),
      oldFolderHandlers.handleDeleteFolder(folder)
    ]);
    await vi.advanceTimersByTimeAsync(600);
    expect(harness.state.editorContent).toBe("draft before switching");
    expect(hasPendingSave(`${rootA}/note.md`)).toBe(false);
    expect(writeMock).toHaveBeenCalledOnce();
    for (const operation of [
      createMock,
      renameMock,
      copyMock,
      deleteMock,
      folderCreateMock,
      folderRenameMock,
      folderDeleteMock,
      formatMock,
      pinsMock
    ]) {
      expect(operation).not.toHaveBeenCalled();
    }

    scan.resolve(scanData(rootB));
    await settle();
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
    expect(harness.state.notes[0].filePath).toBe(`${rootB}/note.md`);
    harness.state.selectNote("note.md");
    harness.state.updateNoteContent("B new draft");
    await flushAllDebouncedSaves(() => harness.state);
    expect(writeMock).toHaveBeenLastCalledWith(`${rootB}/note.md`, "B new draft");
  });

  it.each(["cancelled", "rejected", "save-failed"] as const)(
    "recovers the old workspace and unlocks editing after %s",
    async (failure) => {
      await openA();
      harness.state.updateNoteContent("A preserved draft");
      if (failure === "save-failed") writeMock.mockRejectedValueOnce(new Error("disk full"));
      const scan = beginSwitch();
      await settle();
      if (failure === "cancelled") scan.resolve(null);
      if (failure === "rejected") scan.reject(new Error("scan failed"));
      await settle();
      expect(useWorkspaceStore.getState().workspacePath).toBe(rootA);
      expect(useWorkspaceStore.getState().isLoading).toBe(true);
      expect(harness.state.editorContent).toBe("A preserved draft");
      // A failed flush never reaches the B scan, so discard that unused mock result.
      if (failure === "save-failed") scanMock.mockReset().mockImplementation(async (root: string) => scanData(root));
      renderWorkspaceLoad();
      await settle();
      expect(useWorkspaceStore.getState().isLoading).toBe(false);
      expect(harness.state.editorContent).toBe("A preserved draft");
      harness.state.updateNoteContent("A editing recovered");
      await flushAllDebouncedSaves(() => harness.state);
      expect(writeMock).toHaveBeenLastCalledWith(`${rootA}/note.md`, "A editing recovered");
    }
  );

  it("returns to welcome and releases the lock when the first scan fails", async () => {
    scanMock.mockRejectedValueOnce(new Error("unreadable workspace"));
    useWorkspaceStore.getState().setWorkspacePath(rootA);
    renderWorkspaceLoad();
    await settle();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: null, isLoading: false });
  });

  it("does not unlock a later scan when an obsolete scan completes", async () => {
    await openA();
    const scanB = beginSwitch();
    await settle();
    const scanC = deferred<ReturnType<typeof scanData>>();
    scanMock.mockReturnValueOnce(scanC.promise);
    useWorkspaceStore.getState().setWorkspacePath("/workspace-c");
    renderWorkspaceLoad();
    await settle();
    scanB.resolve(scanData(rootB));
    await settle();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: "/workspace-c", isLoading: true });
    expect(harness.state.notes[0].filePath).toBe(`${rootA}/note.md`);
    scanC.resolve(scanData("/workspace-c"));
    await settle();
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });

  it("recovers the last loaded workspace when a newer scan fails before an earlier scan completed", async () => {
    await openA();
    const scanB = beginSwitch();
    await settle();
    const scanC = deferred<ReturnType<typeof scanData>>();
    scanMock.mockReturnValueOnce(scanC.promise);
    useWorkspaceStore.getState().setWorkspacePath("/workspace-c");
    renderWorkspaceLoad();
    await settle();
    scanC.reject(new Error("C scan failed"));
    await settle();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootA, isLoading: true });
    scanB.resolve(scanData(rootB));
    await settle();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootA, isLoading: true });
    renderWorkspaceLoad();
    await settle();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootA, isLoading: false });
    expect(harness.state.notes[0].filePath).toBe(`${rootA}/note.md`);
  });

  it.each(["rename", "move", "rename-folder", "delete-folder", "rss-update"] as const)(
    "does not resume another operation's watcher pause when an old %s exits before pausing",
    async (kind) => {
      await openA();
      const operation = startOldOperation(kind);
      const scan = beginSwitch();
      await operation;
      await settle();
      expect(pauseMock).not.toHaveBeenCalled();
      expect(resumeMock).not.toHaveBeenCalled();
      expect(useWorkspaceStore.getState().isLoading).toBe(true);
      scan.resolve(scanData(rootB));
      await settle();
    }
  );

  it.each(["create", "rename", "move", "create-folder", "rename-folder", "delete-folder", "rss-update"] as const)(
    "cancels an old %s operation waiting for watcher pause",
    async (kind) => {
      await openA();
      const paused = deferred<void>();
      pauseMock.mockReturnValueOnce(paused.promise);
      const operation = startOldOperation(kind);
      await settle();
      expect(pauseMock).toHaveBeenCalledWith(rootA);
      const scan = beginSwitch();
      await settle();
      paused.resolve();
      await operation;
      for (const mutation of [createMock, renameMock, folderCreateMock, folderRenameMock, folderDeleteMock])
        expect(mutation).not.toHaveBeenCalled();
      expect(resumeMock).toHaveBeenCalledExactlyOnceWith(rootA);
      expect(useWorkspaceStore.getState().isLoading).toBe(true);
      scan.resolve(scanData(rootB));
      await settle();
    }
  );

  it("cancels an old deletion after its save completes during the switch", async () => {
    await openA();
    const saving = deferred<void>();
    writeMock.mockReturnValueOnce(saving.promise);
    const operation = noteHandlers().handleDeleteNote(harness.state.notes[0]);
    await settle();
    const scan = beginSwitch();
    saving.resolve();
    await operation;
    await settle();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(scanMock).toHaveBeenLastCalledWith(rootB);
    scan.resolve(scanData(rootB));
    await settle();
  });

  it("discards an old formatter result while the new workspace scan is pending", async () => {
    await openA();
    const formatting = deferred<string>();
    formatMock.mockReturnValueOnce(formatting.promise);
    const operation = harness.state.formatCurrentNote();
    const scan = beginSwitch();
    await settle();
    formatting.resolve("old formatted content");
    await operation;
    expect(harness.state.editorContent).toBe(`${rootA} disk`);
    expect(hasPendingSave(`${rootA}/note.md`)).toBe(false);
    scan.resolve(scanData(rootB));
    await settle();
  });

  it("does not add a completed old create operation to the new workspace", async () => {
    await openA();
    const creating = deferred<void>();
    createMock.mockReturnValueOnce(creating.promise);
    const operation = harness.state.createNote(undefined, "new");
    await settle();
    expect(createMock).toHaveBeenCalledWith(`${rootA}/new.md`, expect.any(String));
    const scan = beginSwitch();
    await settle();
    scan.resolve(scanData(rootB));
    await settle();
    creating.resolve();
    await operation;
    expect(harness.state.notes.map((note) => note.filePath)).toEqual([`${rootB}/note.md`]);
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
  });
});
