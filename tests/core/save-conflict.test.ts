import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const io = vi.hoisted(() => ({
  write: vi.fn(),
  read: vi.fn(),
  create: vi.fn(),
  exists: vi.fn(),
  saveDraftAs: vi.fn()
}));
vi.mock("electron", () => ({ shell: {} }));
vi.mock("@/ipc", () => ({ fileIpc: io }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/file-watcher", () => ({
  handleFileChanged: async (_id: string, file: string) => (await io.read(file)).content,
  handleFileAdded: vi.fn()
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ folders: [], setFolders: vi.fn() }) }
}));

import { writeExistingFile } from "../../apps/desktop/src/main/file-system/guarded-write";
import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { createFileEventHandlers } from "../../apps/desktop/src/renderer/src/stores/note-store/file-events";
import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import {
  applyPersistence,
  assertNoSaveConflict,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  getLastSavedContent,
  hasPendingSave,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";
import { useSaveConflictStore } from "../../apps/desktop/src/renderer/src/stores/note-store/save-conflicts";

describe("external edit conflict preservation", () => {
  let root: string;
  let filePath: string;
  let state: NoteStore;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-save-conflict-"));
    filePath = path.join(root, "note.md");
    await fs.writeFile(filePath, "baseline");
    io.write.mockReset().mockImplementation(writeExistingFile);
    io.read.mockReset().mockImplementation(async (file: string) => {
      try {
        if ((await fs.stat(file)).isDirectory()) {
          throw Object.assign(new Error("Target is a directory"), { code: "EISDIR" });
        }
        return await fileSystem.readFile(file);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        throw Object.assign(error as Error, {
          code: code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR" ? "FILE_NOT_FOUND" : "FILE_READ_FAILED"
        });
      }
    });
    io.create.mockReset().mockImplementation((file: string, content: string) => fileSystem.createFile(file, content));
    io.exists.mockReset().mockImplementation((file: string) => fileSystem.exists(file));
    io.saveDraftAs.mockReset();
    useWorkspaceStore.setState({ workspacePath: root, isLoading: false });
    useSaveConflictStore.setState({ conflicts: {} });
    state = {
      notes: [{ id: "note.md", title: "note", fileName: "note.md", filePath, content: "baseline" }],
      selectedNoteId: "note.md",
      editorContent: "baseline",
      openNoteIds: ["note.md"],
      playingNoteIds: [],
      savingNoteIds: new Set()
    } as unknown as NoteStore;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(state);
      else Object.assign(state, update);
    };
    Object.assign(
      state,
      applyPersistence(set, () => state),
      createFileEventHandlers(set, () => state)
    );
    setLastSavedContent("note.md", "baseline");
    vi.useFakeTimers();
  });
  afterEach(async () => {
    clearAllDebouncedSaves();
    for (const note of state.notes) clearPendingSave(note.id);
    useSaveConflictStore.setState({ conflicts: {} });
    vi.useRealTimers();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("pauses timer, explicit saves and flush after the external event, then preserves both drafts", async () => {
    state.updateNoteContent("local draft");
    await fs.writeFile(filePath, "external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    expect(useSaveConflictStore.getState().conflicts[filePath]).toMatchObject({
      localContent: "local draft",
      diskContent: "external draft"
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(io.write).not.toHaveBeenCalled();
    await expect(state.saveNoteToFileSystem("note.md", "local draft")).rejects.toMatchObject({
      code: "FILE_CONTENT_CONFLICT"
    });
    await expect(flushAllDebouncedSaves(() => state)).rejects.toThrow();
    expect(() => assertNoSaveConflict(filePath)).toThrow();
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");

    state.updateNoteContent("latest local draft");
    await vi.advanceTimersByTimeAsync(600);
    expect(io.write).not.toHaveBeenCalled();
    await state.resolveSaveConflict(filePath);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    expect(await fs.readFile(backup.filePath!, "utf8")).toBe("latest local draft");
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");
    expect(state.editorContent).toBe("external draft");
    expect(getLastSavedContent("note.md")).toBe("external draft");
    expect(hasPendingSave(filePath)).toBe(false);
    expect(useSaveConflictStore.getState().conflicts).toEqual({});
    state.updateNoteContent("new edit based on external draft");
    await flushAllDebouncedSaves(() => state);
    expect(await fs.readFile(filePath, "utf8")).toBe("new edit based on external draft");
  });

  it("detects the changed disk baseline before saving even when no watcher notification has arrived", async () => {
    state.updateNoteContent("local draft");
    await fs.writeFile(filePath, "external draft");
    await expect(flushAllDebouncedSaves(() => state)).rejects.toMatchObject({ code: "FILE_CONTENT_CONFLICT" });
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");
    expect(state.editorContent).toBe("local draft");
    expect(hasPendingSave(filePath)).toBe(true);
    expect(getLastSavedContent("note.md")).toBe("baseline");
    expect(useSaveConflictStore.getState().conflicts[filePath].diskContent).toBe("external draft");
    await vi.advanceTimersByTimeAsync(600);
    expect(io.write).toHaveBeenCalledOnce();
    await expect(flushAllDebouncedSaves(() => state)).rejects.toThrow();
    expect(io.write).toHaveBeenCalledOnce();
  });

  it("preserves an explicit pending revert when the external event arrives before it is saved", async () => {
    state.updateNoteContent("temporary edit");
    state.updateNoteContent("baseline");
    await fs.writeFile(filePath, "external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    expect(state.editorContent).toBe("baseline");
    await expect(flushAllDebouncedSaves(() => state)).rejects.toThrow();
    await state.resolveSaveConflict(filePath);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    expect(await fs.readFile(backup.filePath!, "utf8")).toBe("baseline");
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");
  });

  it("does not flag a save notification as an external conflict while a newer local edit is pending", async () => {
    state.updateNoteContent("first local edit");
    await flushAllDebouncedSaves(() => state);
    state.updateNoteContent("newer local edit");
    await state.handleFileChangedEvent("note.md", filePath);
    expect(useSaveConflictStore.getState().conflicts).toEqual({});
    await flushAllDebouncedSaves(() => state);
    expect(await fs.readFile(filePath, "utf8")).toBe("newer local edit");
  });

  it("re-reads a known note when the watcher reports the same path added again", async () => {
    await fs.writeFile(filePath, "replaced version");

    await state.handleFileAddedEvent("note.md", filePath);

    expect(state.notes).toHaveLength(1);
    expect(state.editorContent).toBe("replaced version");
    expect(getLastSavedContent("note.md")).toBe("replaced version");
  });

  it("keeps the conflict and both drafts intact if the backup cannot be written", async () => {
    state.updateNoteContent("local draft");
    await fs.writeFile(filePath, "external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    io.create.mockRejectedValue(new Error("disk full"));
    await expect(state.resolveSaveConflict(filePath)).rejects.toThrow("disk full");
    expect(state.editorContent).toBe("local draft");
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");
    expect(hasPendingSave(filePath)).toBe(true);
    await expect(flushAllDebouncedSaves(() => state)).rejects.toThrow();
  });

  it("allows a deleted workspace's draft to be saved through an alternate destination", async () => {
    const recovery = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-recovered-draft-"));
    const backup = path.join(recovery, "backup.md");
    try {
      state.updateNoteContent("draft after workspace was moved");
      await fs.rm(root, { recursive: true, force: true });
      state.handleFileDeletedEvent("note.md");
      io.saveDraftAs.mockResolvedValueOnce(false);
      expect(await state.resolveSaveConflict(filePath, "Save draft as")).toBeNull();
      expect(hasPendingSave(filePath)).toBe(true);
      expect(useSaveConflictStore.getState().conflicts[filePath]).toBeDefined();
      expect(state.editorContent).toBe("draft after workspace was moved");

      io.saveDraftAs.mockImplementationOnce(async (_name: string, content: string) => {
        await fs.writeFile(backup, content);
        return true;
      });
      expect(await state.resolveSaveConflict(filePath, "Save draft as")).toEqual({ originalReadFailed: false });
      expect(await fs.readFile(backup, "utf8")).toBe("draft after workspace was moved");
      expect(io.exists).not.toHaveBeenCalled();
      expect(state.openNoteIds).toEqual([]);
      expect(state.selectedNoteId).toBeNull();
      expect(hasPendingSave(filePath)).toBe(false);
      expect(useSaveConflictStore.getState().conflicts).toEqual({});
      await expect(flushAllDebouncedSaves(() => state)).resolves.toBeUndefined();
    } finally {
      await fs.rm(recovery, { recursive: true, force: true });
    }
  });

  it("recovers a draft without using an unrelated selected note with the same ID", async () => {
    state.updateNoteContent("draft to recover");
    await fs.unlink(filePath);
    state.handleFileDeletedEvent("note.md");
    const otherPath = path.join(root, "other", "note.md");
    state.notes[0] = { ...state.notes[0], filePath: otherPath, content: "other note" };
    state.editorContent = "other note";
    io.saveDraftAs.mockResolvedValueOnce(true);

    expect(await state.resolveSaveConflict(filePath, "Save draft as")).toEqual({ originalReadFailed: false });

    expect(io.saveDraftAs).toHaveBeenCalledWith(
      expect.stringMatching(/\.md$/),
      "draft to recover",
      "Save draft as",
      undefined
    );
    expect(state.openNoteIds).toEqual(["note.md"]);
    expect(state.editorContent).toBe("other note");
    expect(state.notes[0].filePath).toBe(otherPath);
  });

  it("keeps an unreadable original in its tab after saving the draft elsewhere", async () => {
    state.updateNoteContent("draft to recover");
    await fs.writeFile(filePath, "external version");
    await state.handleFileChangedEvent("note.md", filePath);
    io.saveDraftAs.mockResolvedValueOnce(true);
    io.read.mockRejectedValueOnce(Object.assign(new Error("Temporarily unreadable"), { code: "FILE_READ_FAILED" }));

    expect(await state.resolveSaveConflict(filePath, "Save draft as")).toEqual({ originalReadFailed: true });

    expect(io.saveDraftAs).toHaveBeenCalledWith(
      expect.stringMatching(/\.md$/),
      "draft to recover",
      "Save draft as",
      undefined
    );
    expect(state.openNoteIds).toEqual(["note.md"]);
    expect(state.selectedNoteId).toBe("note.md");
    expect(state.editorContent).toBe("external version");
    expect(getLastSavedContent("note.md")).toBe("external version");
    expect(useSaveConflictStore.getState().conflicts).toEqual({});
    await expect(flushAllDebouncedSaves(() => state)).resolves.toBeUndefined();
    expect(io.write).not.toHaveBeenCalled();
    expect(await fs.readFile(filePath, "utf8")).toBe("external version");
  });

  it("replaces a stale tab with the recovered draft when a directory occupies the original path", async () => {
    state.updateNoteContent("draft to recover");
    await fs.writeFile(filePath, "external version");
    await state.handleFileChangedEvent("note.md", filePath);
    await fs.unlink(filePath);
    await fs.mkdir(filePath);

    expect(await state.resolveSaveConflict(filePath)).toEqual({ originalReadFailed: false });
    const [recovered] = state.notes;
    expect(state.notes).toHaveLength(1);
    expect(recovered.content).toBe("draft to recover");
    expect(await fs.readFile(recovered.filePath!, "utf8")).toBe("draft to recover");
    expect(await fs.readdir(filePath)).toEqual([]);
    expect(state.openNoteIds).toEqual([recovered.id]);
    expect(state.selectedNoteId).toBe(recovered.id);
    expect(useSaveConflictStore.getState().conflicts).toEqual({});
  });

  it("reads the latest external version again after preserving the local draft", async () => {
    state.updateNoteContent("local draft");
    await fs.writeFile(filePath, "first external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    io.create.mockImplementationOnce(async (file: string, content: string) => {
      await fileSystem.createFile(file, content);
      await fs.writeFile(filePath, "newest external draft");
    });
    await state.resolveSaveConflict(filePath);
    expect(state.editorContent).toBe("newest external draft");
    expect(getLastSavedContent("note.md")).toBe("newest external draft");
    expect(await fs.readFile(filePath, "utf8")).toBe("newest external draft");
  });

  it("preserves a deleted file's draft in a new note without recreating the external path", async () => {
    state.updateNoteContent("local draft");
    await fs.unlink(filePath);
    state.handleFileDeletedEvent("note.md");
    await state.resolveSaveConflict(filePath);
    expect(await fileSystem.exists(filePath)).toBe(false);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    expect(await fs.readFile(backup.filePath!, "utf8")).toBe("local draft");
    expect(state.selectedNoteId).toBe(backup.id);
  });

  it("recovers a deleted file's draft even when the watcher has not reported the deletion", async () => {
    state.updateNoteContent("unsaved draft");
    await fs.unlink(filePath);
    io.write.mockRejectedValueOnce(Object.assign(new Error("File is missing"), { code: "FILE_NOT_FOUND" }));

    await expect(flushAllDebouncedSaves(() => state)).rejects.toMatchObject({ code: "FILE_NOT_FOUND" });
    expect(useSaveConflictStore.getState().conflicts[filePath]).toMatchObject({
      localContent: "unsaved draft",
      diskContent: null
    });

    await state.resolveSaveConflict(filePath);
    expect(await fileSystem.exists(filePath)).toBe(false);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    expect(await fs.readFile(backup.filePath!, "utf8")).toBe("unsaved draft");
  });

  it("does not give the recovered copy the source note's GitHub association", async () => {
    state.updateNoteContent(
      "<!-- github-issue-number: 12 -->\n<!-- github-issue-url: https://github.com/owner/repo/issues/12 -->\nlocal draft"
    );
    await fs.writeFile(filePath, "external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    await state.resolveSaveConflict(filePath);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    const content = await fs.readFile(backup.filePath!, "utf8");
    expect(content).toContain("local draft");
    expect(content).not.toContain("github-issue-");
    expect(backup.github).toBeUndefined();
  });

  it("can preserve a draft whose original filename is near the filesystem filename limit", async () => {
    const longName = `${"n".repeat(230)}.md`;
    const longPath = path.join(root, longName);
    await fs.rename(filePath, longPath);
    filePath = longPath;
    state.notes[0].filePath = longPath;
    state.notes[0].fileName = longName;
    state.updateNoteContent("local draft");
    await fs.writeFile(filePath, "external draft");
    await state.handleFileChangedEvent("note.md", filePath);
    await state.resolveSaveConflict(filePath);
    const backup = state.notes.find((note) => note.filePath !== filePath)!;
    expect(await fs.readFile(backup.filePath!, "utf8")).toBe("local draft");
    expect(await fs.readFile(filePath, "utf8")).toBe("external draft");
  });
});
