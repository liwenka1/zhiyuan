import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { write, rename } = vi.hoisted(() => ({ write: vi.fn(), rename: vi.fn() }));
vi.mock("electron", () => ({ shell: {} }));
vi.mock("@/ipc", () => ({
  fileIpc: { write, rename },
  watcherIpc: { pause: vi.fn(), resume: vi.fn() },
  configIpc: { setPinnedNotes: vi.fn() }
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  hasPendingSave,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => (resolve = finish));
  return { promise, resolve };
}

describe("explicit saves and their debounce ownership", () => {
  let root: string;
  let filePath: string;
  let state: NoteStore;

  const writeExisting = async (file: string, content: string) => {
    // Preserve the real file:write boundary: a late write must not recreate a renamed note.
    await fs.stat(file);
    await fileSystem.writeFile(file, content);
  };

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-save-timer-"));
    filePath = path.join(root, "note.md");
    await fs.writeFile(filePath, "original");
    write.mockReset().mockImplementation(writeExisting);
    rename.mockReset().mockImplementation((oldPath: string, newPath: string) => fs.rename(oldPath, newPath));
    useWorkspaceStore.setState({ workspacePath: root, isLoading: false });
    state = {
      notes: [{ id: "note.md", title: "note", fileName: "note.md", filePath, content: "original" }],
      selectedNoteId: "note.md",
      editorContent: "original",
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
      createNoteActions(set, () => state),
      applyPersistence(set, () => state)
    );
    setLastSavedContent("note.md", "original");
    vi.useFakeTimers();
  });

  afterEach(async () => {
    clearAllDebouncedSaves();
    await flushAllDebouncedSaves(() => state).catch(() => {});
    clearPendingSave("note.md");
    for (const note of state.notes) clearPendingSave(note.id);
    vi.useRealTimers();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("does not write the old path after an explicit metadata save and subsequent rename", async () => {
    state.updateNoteContentById("note.md", "saved metadata and body");
    await state.saveNoteToFileSystem("note.md", "saved metadata and body", filePath);
    expect(hasPendingSave(filePath)).toBe(false);
    await state.renameNote("note.md", "renamed");
    const writesBeforeTimer = write.mock.calls.length;

    await vi.advanceTimersByTimeAsync(501);

    expect(write).toHaveBeenCalledTimes(writesBeforeTimer);
    expect(hasPendingSave(filePath)).toBe(false);
    expect(await fs.readFile(path.join(root, "renamed.md"), "utf8")).toBe("saved metadata and body");
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps the debounce for newer input queued while the explicit save is writing", async () => {
    const writing = deferred();
    write.mockImplementationOnce(async (file: string, content: string) => {
      await writing.promise;
      await writeExisting(file, content);
    });
    state.updateNoteContentById("note.md", "metadata");
    const saving = state.saveNoteToFileSystem("note.md", "metadata", filePath);
    for (let index = 0; index < 5; index++) await Promise.resolve();
    expect(write).toHaveBeenCalledOnce();
    state.updateNoteContent("metadata with a newer edit");
    writing.resolve();
    await saving;
    write.mockClear();

    await vi.advanceTimersByTimeAsync(501);

    expect(write).toHaveBeenCalledWith(filePath, "metadata with a newer edit");
    await flushAllDebouncedSaves(() => state);
    expect(await fs.readFile(filePath, "utf8")).toBe("metadata with a newer edit");
  });
});
