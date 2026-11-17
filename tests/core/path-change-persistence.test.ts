import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { ipc, harness } = vi.hoisted(() => ({
  ipc: {
    read: vi.fn(),
    write: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    exists: vi.fn(),
    renameFolder: vi.fn(),
    setPinnedNotes: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn()
  },
  harness: { state: null as unknown as NoteStore }
}));
vi.mock("electron", () => ({ shell: {} }));
vi.mock("@/ipc", () => ({
  fileIpc: {
    read: ipc.read,
    write: ipc.write,
    create: ipc.create,
    rename: ipc.rename,
    exists: ipc.exists
  },
  folderIpc: { rename: ipc.renameFolder },
  configIpc: { setPinnedNotes: ipc.setPinnedNotes },
  watcherIpc: { pause: ipc.pause, resume: ipc.resume }
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store", () => ({
  useNoteStore: {
    getState: () => harness.state,
    setState: (update: ((state: NoteStore) => Partial<NoteStore>) | Partial<NoteStore>) => {
      Object.assign(harness.state, typeof update === "function" ? update(harness.state) : update);
    }
  }
}));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import { createFileEventHandlers } from "../../apps/desktop/src/renderer/src/stores/note-store/file-events";
import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  getLastSavedContent,
  hasPendingSave,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";

describe("path changes preserve the actual file before watcher delivery", () => {
  let root: string;
  let watcher: FSWatcher | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-path-content-"));
    await fs.mkdir(path.join(root, "dest"));
    await fs.mkdir(path.join(root, "folder", "child"), { recursive: true });
    ipc.read.mockImplementation((file: string) => fileSystem.readFile(file));
    ipc.write.mockImplementation((file: string, content: string, expected?: string) =>
      fileSystem.writeFile(file, content, expected)
    );
    ipc.create.mockImplementation((file: string, content: string) => fileSystem.createFile(file, content));
    ipc.rename.mockImplementation((oldPath: string, newPath: string) => fileSystem.renameFile(oldPath, newPath));
    ipc.renameFolder.mockImplementation((oldPath: string, newPath: string) =>
      fileSystem.renameFolder(oldPath, newPath)
    );
    ipc.exists.mockImplementation((file: string) => fileSystem.exists(file));
    useWorkspaceStore.setState({ workspacePath: root, isLoading: false });
    useFolderStore.setState({
      folders: [
        { id: "dest", name: "dest", path: path.join(root, "dest") },
        { id: "folder", name: "folder", path: path.join(root, "folder") },
        { id: "folder/child", name: "folder/child", path: path.join(root, "folder", "child") }
      ],
      selectedFolderId: null
    });
    harness.state = {
      notes: [],
      selectedNoteId: null,
      editorContent: "",
      savingNoteIds: new Set(),
      openNoteIds: [],
      playingNoteIds: []
    } as unknown as NoteStore;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(harness.state);
      else Object.assign(harness.state, update);
    };
    Object.assign(
      harness.state,
      createNoteActions(set, () => harness.state),
      applyPersistence(set, () => harness.state),
      createFileEventHandlers(set, () => harness.state)
    );
  });

  afterEach(async () => {
    clearAllDebouncedSaves();
    for (const note of harness.state.notes) clearPendingSave(note.id);
    clearPendingSave("a.md");
    clearPendingSave("folder/child/a.md");
    await watcher?.close();
    watcher = undefined;
    await fs.rm(root, { recursive: true, force: true });
  });

  async function addNote(id = "a.md", selected = true) {
    const filePath = path.join(root, ...id.split("/"));
    await fs.writeFile(filePath, "original");
    const fileName = path.basename(filePath);
    harness.state.notes.push({
      id,
      title: fileName.slice(0, -3),
      fileName,
      filePath,
      folderId: id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : undefined,
      content: "original",
      isPinned: true
    });
    if (selected) {
      harness.state.selectedNoteId = id;
      harness.state.editorContent = "original";
    }
    setLastSavedContent(id, "original");
    return filePath;
  }

  async function watchBeforeExternalWrite() {
    const received: string[] = [];
    const delivered: string[] = [];
    const queued: string[] = [];
    let holdDelivery = true;
    const deliver = async (file: string) => {
      delivered.push(file);
      await harness.state.handleFileChangedEvent(path.relative(root, file).replaceAll("\\", "/"), file);
    };
    watcher = chokidar.watch(root, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 }
    });
    watcher.on("change", (file) => {
      received.push(file);
      if (holdDelivery) queued.push(file);
      else void deliver(file);
    });
    await new Promise<void>((resolve, reject) => {
      watcher!.once("ready", resolve);
      watcher!.once("error", reject);
    });
    return {
      received,
      delivered,
      release: async () => {
        holdDelivery = false;
        for (const file of queued.splice(0)) await deliver(file);
      }
    };
  }

  it.each(["rename", "move"] as const)(
    "does not overwrite an external draft when a clean selected note is %s",
    async (kind) => {
      const oldPath = await addNote();
      const notifications = await watchBeforeExternalWrite();
      await fs.writeFile(oldPath, "external new draft");
      await vi.waitFor(() => expect(notifications.received).toContain(oldPath));
      expect(notifications.delivered).toEqual([]);
      expect(harness.state.editorContent).toBe("original");

      if (kind === "rename") await harness.state.renameNote("a.md", "renamed");
      else expect(await harness.state.moveNote("a.md", "dest")).toMatchObject({ moved: true });

      const note = harness.state.notes[0];
      expect(ipc.write).not.toHaveBeenCalled();
      expect(await fs.readFile(note.filePath!, "utf8")).toBe("external new draft");
      expect(note.content).toBe("external new draft");
      expect(harness.state.editorContent).toBe("external new draft");
      expect(getLastSavedContent(note.id)).toBe("external new draft");
      expect(ipc.setPinnedNotes).toHaveBeenCalledWith(root, [note.id]);
      await notifications.release();
      expect(notifications.delivered).toContain(oldPath);

      harness.state.updateNoteContent("later local draft");
      await flushAllDebouncedSaves(() => harness.state);
      expect(await fs.readFile(note.filePath!, "utf8")).toBe("later local draft");
      expect(hasPendingSave(oldPath)).toBe(false);
      expect(await fileSystem.exists(oldPath)).toBe(false);
    }
  );

  it.each(["rename", "move"] as const)(
    "flushes a dirty note before %s without leaving a save on its old path",
    async (kind) => {
      const oldPath = await addNote();
      harness.state.updateNoteContent("local draft");
      if (kind === "rename") await harness.state.renameNote("a.md", "renamed");
      else expect(await harness.state.moveNote("a.md", "dest")).toMatchObject({ moved: true });
      const note = harness.state.notes[0];
      expect(await fs.readFile(note.filePath!, "utf8")).toBe("local draft");
      expect(note.content).toBe("local draft");
      expect(getLastSavedContent(note.id)).toBe("local draft");
      expect(hasPendingSave(oldPath)).toBe(false);
      await flushAllDebouncedSaves(() => harness.state);
      expect(await fileSystem.exists(oldPath)).toBe(false);
    }
  );

  it("renames a directory with a clean nested note without writing the stale editor", async () => {
    const oldPath = await addNote("folder/child/a.md");
    await fs.writeFile(oldPath, "external nested draft");

    await useFolderStore.getState().renameFolder("folder", "renamed");

    const note = harness.state.notes[0];
    expect(ipc.write).not.toHaveBeenCalled();
    expect(note.id).toBe("renamed/child/a.md");
    expect(await fs.readFile(note.filePath!, "utf8")).toBe("external nested draft");
    expect(note.content).toBe("external nested draft");
    expect(harness.state.editorContent).toBe("external nested draft");
    expect(getLastSavedContent(note.id)).toBe("external nested draft");
    expect(ipc.setPinnedNotes).toHaveBeenCalledWith(root, [note.id]);
  });

  it("flushes a dirty background note in a nested directory before renaming its parent", async () => {
    const oldPath = await addNote("folder/child/a.md", false);
    harness.state.updateNoteContentById("folder/child/a.md", "background local draft");

    await useFolderStore.getState().renameFolder("folder", "renamed");

    const note = harness.state.notes[0];
    expect(await fs.readFile(note.filePath!, "utf8")).toBe("background local draft");
    expect(note.content).toBe("background local draft");
    expect(getLastSavedContent(note.id)).toBe("background local draft");
    expect(hasPendingSave(oldPath)).toBe(false);
    expect(await fileSystem.exists(oldPath)).toBe(false);
  });

  it("refreshes a clean unselected note while leaving the current editor unchanged", async () => {
    const oldPath = await addNote("a.md", false);
    harness.state.editorContent = "another editor";
    await fs.writeFile(oldPath, "external background draft");

    await harness.state.renameNote("a.md", "renamed");

    expect(ipc.write).not.toHaveBeenCalled();
    expect(harness.state.notes[0].content).toBe("external background draft");
    expect(getLastSavedContent("renamed.md")).toBe("external background draft");
    expect(harness.state.editorContent).toBe("another editor");
  });

  it("duplicates the real clean source without overwriting it with cached content", async () => {
    const oldPath = await addNote();
    await fs.writeFile(oldPath, "external source");

    await harness.state.duplicateNote("a.md");

    expect(ipc.write).not.toHaveBeenCalled();
    expect(await fs.readFile(oldPath, "utf8")).toBe("external source");
    expect(harness.state.notes).toHaveLength(2);
    expect(await fs.readFile(harness.state.notes[1].filePath!, "utf8")).toBe("external source");
    expect(harness.state.editorContent).toBe("external source");
    expect(getLastSavedContent("a.md")).toBe("external source");
  });

  it("keeps a successful rename and its last known baseline if reading the new file fails", async () => {
    await addNote();
    ipc.read.mockRejectedValueOnce(new Error("read denied"));

    await expect(harness.state.renameNote("a.md", "renamed")).rejects.toThrow("read denied");

    expect(harness.state.notes[0].id).toBe("renamed.md");
    expect(getLastSavedContent("renamed.md")).toBe("original");
    expect(await fs.readFile(path.join(root, "renamed.md"), "utf8")).toBe("original");
    expect(ipc.setPinnedNotes).toHaveBeenCalledWith(root, ["renamed.md"]);
  });
});
