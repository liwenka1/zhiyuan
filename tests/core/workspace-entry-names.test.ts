import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { workspace, noteStore, create, rename, folderCreate, folderRename, error } = vi.hoisted(() => ({
  workspace: { workspacePath: "", isLoading: false },
  noteStore: { current: null as unknown as NoteStore },
  create: vi.fn(),
  rename: vi.fn(),
  folderCreate: vi.fn(),
  folderRename: vi.fn(),
  error: vi.fn()
}));

vi.mock("electron", () => ({ BrowserWindow: class {}, dialog: {}, shell: { trashItem: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: { addRecentWorkspace: vi.fn() }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspace }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store", () => ({
  useNoteStore: {
    getState: () => noteStore.current,
    setState: (update: Partial<NoteStore> | ((state: NoteStore) => Partial<NoteStore>)) =>
      Object.assign(noteStore.current, typeof update === "function" ? update(noteStore.current) : update)
  }
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error } }));
vi.mock("@/ipc", () => ({
  fileIpc: { create, rename },
  folderIpc: { create: folderCreate, rename: folderRename },
  watcherIpc: { pause: vi.fn(), resume: vi.fn() },
  configIpc: { setPinnedNotes: vi.fn() }
}));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { workspaceManager } from "../../apps/desktop/src/main/workspace";
import { sanitizeName } from "../../apps/desktop/src/main/utils/content-import";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";

describe("created workspace entries remain discoverable", () => {
  let root: string;
  let state: NoteStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-entry-names-"));
    workspace.workspacePath = root;
    create.mockImplementation((filePath: string, content: string) => fileSystem.createFile(filePath, content));
    rename.mockImplementation((oldPath: string, newPath: string) => fileSystem.renameFile(oldPath, newPath));
    folderCreate.mockImplementation((folderPath: string) => fileSystem.createFolder(folderPath));
    folderRename.mockImplementation((oldPath: string, newPath: string) => fileSystem.renameFolder(oldPath, newPath));
    useFolderStore.setState({ folders: [], selectedFolderId: null });
    state = {
      notes: [],
      selectedNoteId: null,
      editorContent: "",
      openNoteIds: [],
      playingNoteIds: [],
      savingNoteIds: new Set(),
      saveNoteToFileSystem: vi.fn()
    } as unknown as NoteStore;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(state);
      else Object.assign(state, update);
    };
    Object.assign(
      state,
      createNoteActions(set, () => state)
    );
    noteStore.current = state;
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("rejects hidden note titles at the real creation entry point", async () => {
    await expect(state.createNote(undefined, ".draft")).resolves.toBeUndefined();

    expect(create).not.toHaveBeenCalled();
    expect(state.notes).toEqual([]);
    expect(await readdir(root)).toEqual([]);
    expect((await workspaceManager.scanWorkspace(root)).notes).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it("keeps a valid created note discoverable when a hidden rename is rejected", async () => {
    await expect(state.createNote(undefined, "draft")).resolves.toBe("draft.md");
    expect(state.selectedNoteId).toBe("draft.md");
    const originalContent = state.notes[0].content;
    await state.renameNote("draft.md", ".draft");

    expect(rename).not.toHaveBeenCalled();
    expect(await readFile(path.join(root, "draft.md"), "utf8")).toBe(originalContent);
    const scanned = await workspaceManager.scanWorkspace(root);
    expect(scanned.notes).toEqual([expect.objectContaining({ id: "draft.md", content: originalContent })]);
    expect(state.notes[0].fileName).toBe("draft.md");
  });

  it("normalizes hidden imported titles to a visible file name before rescanning", async () => {
    const importedTitle = sanitizeName(".hidden source");
    await fileSystem.createFile(path.join(root, `${importedTitle}.md`), "imported article");

    expect((await workspaceManager.scanWorkspace(root)).notes).toEqual([
      expect.objectContaining({ id: "untitled.md", content: "imported article" })
    ]);
  });

  it.each(["dist", "build", "node_modules"])("rejects ignored directory name %s at folder creation", async (name) => {
    await useFolderStore.getState().createFolder(name);

    expect(folderCreate).not.toHaveBeenCalled();
    expect(useFolderStore.getState().folders).toEqual([]);
    expect(await readdir(root)).toEqual([]);
    expect(error).toHaveBeenCalled();
  });

  it.each(["dist", "build", "node_modules"])(
    "preserves discoverable notes when renaming a folder to %s is rejected",
    async (name) => {
      await useFolderStore.getState().createFolder("notes");
      await state.createNote("notes", "draft");

      await useFolderStore.getState().renameFolder("notes", name);

      expect(folderRename).not.toHaveBeenCalled();
      expect((await workspaceManager.scanWorkspace(root)).notes).toEqual([
        expect.objectContaining({ id: "notes/draft.md", content: state.notes[0].content })
      ]);
      expect(useFolderStore.getState().folders[0].id).toBe("notes");
    }
  );

  it("still allows a note called dist because only generated directories are ignored", async () => {
    await state.createNote(undefined, "dist");

    expect((await workspaceManager.scanWorkspace(root)).notes).toEqual([
      expect.objectContaining({ id: "dist.md", content: state.notes[0].content })
    ]);
  });
});
