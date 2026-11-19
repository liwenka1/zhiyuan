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
    effectDependencies: [] as Array<readonly unknown[] | undefined>,
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
  useEffect: (effect: () => unknown, dependencies?: readonly unknown[]) => {
    harness.effectDependencies[harness.effects.length] = dependencies;
    harness.effects.push(effect);
  },
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
  fileIpc: {
    write: writeMock,
    create: createMock,
    rename: renameMock,
    delete: deleteMock,
    copy: copyMock,
    exists: vi.fn().mockResolvedValue(false),
    read: vi.fn()
  },
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
import {
  getLastSavedContent,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";
import { useWindowClose } from "../../apps/desktop/src/renderer/src/hooks/use-window-close";
import {
  beginBackgroundSave,
  useOperationStore
} from "../../apps/desktop/src/renderer/src/stores/note-store/operation-guard";
import { moveNotesInWorkspace } from "../../apps/desktop/src/renderer/src/features/note-workspace/lib/move-notes";
import { configIpc } from "@/ipc";
import { fileIpc } from "@/ipc";
import { createFileEventHandlers } from "../../apps/desktop/src/renderer/src/stores/note-store/file-events";
import {
  getGitHubIssueNumberForRepository,
  parseGitHubMetadata,
  upsertGitHubMetadata
} from "../../apps/desktop/src/renderer/src/lib/github-metadata";
import { useWorkspaceInit } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-workspace-init";
import { useNoteHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-note-handlers";
import { useFolderHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-folder-handlers";

const rootA = "/workspace-a";
const rootB = "/workspace-b";
const folder = { id: "folder", name: "folder", path: `${rootA}/folder` };
const savedFiles = new Map<string, string>();

function scanData(root: string) {
  if (!savedFiles.has(`${root}/note.md`)) savedFiles.set(`${root}/note.md`, `${root} disk`);
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

function renameSavedFiles(oldPath: string, newPath: string) {
  for (const [file, content] of [...savedFiles]) {
    if (file === oldPath || file.startsWith(`${oldPath}/`)) {
      savedFiles.delete(file);
      savedFiles.set(newPath + file.slice(oldPath.length), content);
    }
  }
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
    renameMock
      .mockReset()
      .mockImplementation(async (oldPath: string, newPath: string) => renameSavedFiles(oldPath, newPath));
    folderRenameMock
      .mockReset()
      .mockImplementation(async (oldPath: string, newPath: string) => renameSavedFiles(oldPath, newPath));
    createMock.mockReset().mockResolvedValue(undefined);
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
      isLoadingFromFileSystem: false
    } as unknown as NoteStore;
    const get = () => harness.state;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(harness.state);
      else Object.assign(harness.state, update);
    };
    Object.assign(
      harness.state,
      createNoteActions(set, get),
      applyPersistence(set, get),
      createLoaders(set, get),
      createFileEventHandlers(set, get)
    );
    scanMock.mockImplementation(async (root: string) => scanData(root));
    writeMock.mockImplementation(async (filePath: string, content: string) => {
      savedFiles.set(filePath, content);
    });
    vi.mocked(fileIpc.read).mockImplementation(async (filePath: string) => ({
      content: savedFiles.get(filePath)!,
      mtime: 0
    }));
    pauseMock.mockResolvedValue(undefined);
    formatMock.mockResolvedValue("formatted");
    vi.stubGlobal("window", { confirm: () => true, setTimeout });
  });

  afterEach(() => {
    clearAllDebouncedSaves();
    for (const note of harness.state.notes) clearPendingSave(note.id);
    clearPendingSave("note.md");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the scan dependencies stable when the translation function changes", async () => {
    await openA();
    const originalDependencies = harness.effectDependencies[0];

    // The mocked translation hook returns a new t function for this render.
    harness.effects = [];
    harness.refIndex = 0;
    useWorkspaceInit();

    expect(harness.effectDependencies[0]).toStrictEqual(originalDependencies);
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
    expect(writeMock).toHaveBeenCalledWith(`${rootA}/note.md`, "draft before switching", `${rootA} disk`);
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
    expect(writeMock).toHaveBeenLastCalledWith(`${rootB}/note.md`, "B new draft", `${rootB} disk`);
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
      expect(writeMock).toHaveBeenLastCalledWith(
        `${rootA}/note.md`,
        "A editing recovered",
        failure === "save-failed" ? `${rootA} disk` : "A preserved draft"
      );
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
      if (kind === "rename-folder") {
        Object.assign(harness.state.notes[0], {
          id: "folder/note.md",
          filePath: `${rootA}/folder/note.md`,
          folderId: "folder"
        });
        harness.state.selectedNoteId = "folder/note.md";
        setLastSavedContent("folder/note.md", harness.state.editorContent);
        savedFiles.set(`${rootA}/folder/note.md`, harness.state.editorContent);
      }
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

  it("locks new edits while closing waits for a real background save, then acknowledges", async () => {
    await openA();
    harness.state.notes.push({
      id: "background.md",
      title: "background",
      filePath: `${rootA}/background.md`,
      content: "disk"
    });
    setLastSavedContent("background.md", "disk");
    harness.state.updateNoteContentById("background.md", "background draft");
    const writing = deferred<void>();
    writeMock.mockImplementationOnce(async (file: string, content: string) => {
      await writing.promise;
      savedFiles.set(file, content);
    });
    let close!: (token: number) => void;
    const ready = vi.fn().mockResolvedValue({ ok: true });
    window.api = {
      window: {
        onPrepareClose: (callback: typeof close) => {
          close = callback;
          return vi.fn();
        },
        readyToClose: ready
      }
    } as never;
    harness.effects = [];
    useWindowClose();
    harness.effects[0]();
    close(11);
    await settle();
    expect(useOperationStore.getState().closeRequestCount).toBe(1);
    harness.state.updateNoteContent("late input");
    expect(harness.state.editorContent).toBe(`${rootA} disk`);
    expect(ready).not.toHaveBeenCalled();
    writing.resolve();
    await settle();
    expect(savedFiles.get(`${rootA}/background.md`)).toBe("background draft");
    expect(ready).toHaveBeenCalledWith(11);
    expect(useOperationStore.getState().closeRequestCount).toBe(0);
  });

  it("releases the closing lock after a real save failure and preserves a retryable draft", async () => {
    await openA();
    harness.state.updateNoteContent("draft");
    writeMock.mockRejectedValueOnce(new Error("disk full"));
    let close!: (token: number) => void;
    const ready = vi.fn();
    window.api = {
      window: {
        onPrepareClose: (callback: typeof close) => {
          close = callback;
          return vi.fn();
        },
        readyToClose: ready
      }
    } as never;
    harness.effects = [];
    useWindowClose();
    harness.effects[0]();
    close(12);
    await settle();
    expect(ready).not.toHaveBeenCalled();
    expect(useOperationStore.getState().closeRequestCount).toBe(0);
    harness.state.updateNoteContent("retry draft");
    await flushAllDebouncedSaves(() => harness.state);
    expect(savedFiles.get(`${rootA}/note.md`)).toBe("retry draft");
  });

  it.each(["rename", "move", "rename-folder"] as const)(
    "keeps saves and their baseline on the actual path while %s is pending",
    async (kind) => {
      await openA();
      if (kind === "rename-folder") {
        Object.assign(harness.state.notes[0], {
          id: "folder/note.md",
          filePath: `${rootA}/folder/note.md`,
          folderId: "folder"
        });
        harness.state.selectedNoteId = "folder/note.md";
        setLastSavedContent("folder/note.md", harness.state.editorContent);
        savedFiles.delete(`${rootA}/note.md`);
        savedFiles.set(`${rootA}/folder/note.md`, harness.state.editorContent);
      }
      const oldId = harness.state.selectedNoteId!;
      const oldPath = harness.state.notes[0].filePath!;
      const renaming = deferred<void>();
      const mutate = async (oldPath: string, newPath: string) => {
        await renaming.promise;
        renameSavedFiles(oldPath, newPath);
      };
      renameMock.mockImplementation(mutate);
      folderRenameMock.mockImplementation(mutate);
      const operation =
        kind === "rename-folder"
          ? useFolderStore.getState().renameFolder("folder", "renamed")
          : kind === "rename"
            ? harness.state.renameNote(oldId, "renamed")
            : harness.state.moveNote(oldId, "folder");
      await settle();
      expect(useOperationStore.getState().fileOperationCount).toBe(1);
      harness.state.updateNoteContent("input during rename");
      expect(harness.state.editorContent).toBe(`${rootA} disk`);
      renaming.resolve();
      await operation;
      const note = harness.state.notes[0];
      expect(note.filePath).not.toBe(oldPath);
      expect(hasPendingSave(oldPath)).toBe(false);
      expect(getLastSavedContent(note.id)).toBe(savedFiles.get(note.filePath!));
      expect(useOperationStore.getState().fileOperationCount).toBe(0);
      harness.state.updateNoteContent("after rename");
      await flushAllDebouncedSaves(() => harness.state);
      expect(savedFiles.get(note.filePath!)).toBe("after rename");
      expect(savedFiles.has(oldPath)).toBe(false);
    }
  );

  it("cancels the rest of a batch when another workspace with identical IDs becomes ready", async () => {
    await openA();
    const first = deferred<{ moved: boolean }>();
    const moving = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue({ moved: true });
    const batch = moveNotesInWorkspace(["a.md", "b.md"], "folder", moving, useWorkspaceStore.getState());
    useWorkspaceStore.getState().setWorkspacePath(rootB);
    useWorkspaceStore.getState().setLoading(false);
    first.resolve({ moved: false });
    expect((await batch).cancelled).toBe(true);
    expect(moving).toHaveBeenCalledTimes(1);
  });

  it("cancels a batch even when a switch returns to the same root", async () => {
    await openA();
    const first = deferred<{ moved: boolean }>();
    const moving = vi.fn().mockReturnValueOnce(first.promise);
    const batch = moveNotesInWorkspace(["a.md", "b.md"], "folder", moving, { ...useWorkspaceStore.getState() });
    useWorkspaceStore.getState().setWorkspacePath(rootB);
    useWorkspaceStore.getState().setWorkspacePath(rootA);
    useWorkspaceStore.getState().setLoading(false);
    first.resolve({ moved: false });
    expect((await batch).cancelled).toBe(true);
    expect(moving).toHaveBeenCalledTimes(1);
  });

  it("persists a pinned note's new ID so reloading preserves its pin", async () => {
    await openA();
    harness.state.notes[0].isPinned = true;
    await harness.state.moveNote("note.md", "folder");
    const note = { ...harness.state.notes[0] };
    expect(pinsMock).toHaveBeenCalledWith(rootA, ["folder/note.md"]);
    vi.mocked(configIpc.getPinnedNotes).mockResolvedValueOnce(["folder/note.md"]);
    harness.state.notes = [];
    await harness.state.loadFromFileSystem({ notes: [note] }, rootA);
    expect(harness.state.notes[0].isPinned).toBe(true);
  });

  it("reads a real external change immediately after its own save instead of discarding it for 500ms", async () => {
    await openA();
    harness.state.updateNoteContent("local save");
    await flushAllDebouncedSaves(() => harness.state);
    savedFiles.set(`${rootA}/note.md`, "external save");
    await harness.state.handleFileChangedEvent("note.md", `${rootA}/note.md`);
    expect(harness.state.editorContent).toBe("external save");
    expect(getLastSavedContent("note.md")).toBe("external save");
    await harness.state.saveNoteToFileSystem("note.md", harness.state.editorContent);
    expect(savedFiles.get(`${rootA}/note.md`)).toBe("external save");
  });

  it("duplicates published content without inheriting its issue after a disk reload", async () => {
    await openA();
    const published = upsertGitHubMetadata("# Original\n\nbody", {
      issueNumber: 7,
      issueUrl: "https://github.com/owner/repo/issues/7"
    });
    Object.assign(harness.state.notes[0], { content: published, github: parseGitHubMetadata(published) });
    harness.state.editorContent = published;
    createMock.mockImplementation(async (file: string, content: string) => savedFiles.set(file, content));
    await harness.state.duplicateNote("note.md");
    const copy = harness.state.notes.find((note) => note.id !== "note.md")!;
    expect(copy).toBeDefined();
    expect(copy.content).toBe("# Original\n\nbody");
    expect(savedFiles.get(copy.filePath!)).toBe(copy.content);
    const reloaded = harness.state.notes.map((note) => ({ ...note, content: savedFiles.get(note.filePath!)! }));
    harness.state.notes = [];
    await harness.state.loadFromFileSystem({ notes: reloaded }, rootA);
    const reloadedCopy = harness.state.notes.find((note) => note.id === copy.id)!;
    expect(getGitHubIssueNumberForRepository(reloadedCopy.github, "owner", "repo")).toBeUndefined();
    expect(parseGitHubMetadata(savedFiles.get(`${rootA}/note.md`)!)).toMatchObject({ issueNumber: 7 });
  });

  it("waits for a pending rename to synchronize paths before acknowledging close", async () => {
    await openA();
    const renaming = deferred<void>();
    renameMock.mockImplementationOnce(async (oldPath: string, newPath: string) => {
      await renaming.promise;
      renameSavedFiles(oldPath, newPath);
    });
    const operation = harness.state.renameNote("note.md", "renamed");
    await settle();
    let close!: (token: number) => void;
    const ready = vi.fn().mockResolvedValue({ ok: true });
    window.api = {
      window: {
        onPrepareClose: (callback: typeof close) => {
          close = callback;
          return vi.fn();
        },
        readyToClose: ready
      }
    } as never;
    harness.effects = [];
    useWindowClose();
    harness.effects[0]();
    close(13);
    await settle();
    expect(ready).not.toHaveBeenCalled();
    renaming.resolve();
    await operation;
    await settle();
    expect(harness.state.selectedNoteId).toBe("renamed.md");
    expect(ready).toHaveBeenCalledWith(13);
    expect(useOperationStore.getState()).toEqual({ fileOperationCount: 0, closeRequestCount: 0 });
  });

  it("waits for publishing metadata and flushes it before closing while user input stays locked", async () => {
    await openA();
    const finishPublishing = beginBackgroundSave();
    let close!: (token: number) => void;
    const ready = vi.fn().mockResolvedValue({ ok: true });
    window.api = {
      window: {
        onPrepareClose: (callback: typeof close) => {
          close = callback;
          return vi.fn();
        },
        readyToClose: ready
      }
    } as never;
    harness.effects = [];
    useWindowClose();
    harness.effects[0]();
    close(14);
    await settle();
    expect(ready).not.toHaveBeenCalled();
    harness.state.updateNoteContent("late input");
    const content = upsertGitHubMetadata(harness.state.editorContent, {
      issueNumber: 12,
      issueUrl: "https://github.com/owner/repo/issues/12"
    });
    harness.state.updateNoteContentById("note.md", content);
    finishPublishing();
    await settle();
    expect(savedFiles.get(`${rootA}/note.md`)).toBe(content);
    expect(content).not.toContain("late input");
    expect(ready).toHaveBeenCalledWith(14);
  });
});
