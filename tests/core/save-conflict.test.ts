import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const io = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn(), create: vi.fn(), exists: vi.fn() }));
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
    io.read.mockReset().mockImplementation((file: string) => fileSystem.readFile(file));
    io.create.mockReset().mockImplementation((file: string, content: string) => fileSystem.createFile(file, content));
    io.exists.mockReset().mockImplementation((file: string) => fileSystem.exists(file));
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
