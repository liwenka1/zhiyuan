import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("electron", () => ({ shell: {} }));
vi.mock("@/ipc", () => ({ fileIpc: { write }, configIpc: {}, watcherIpc: {} }));
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

describe("switching a selected note before a filesystem event arrives", () => {
  let root: string;
  let state: NoteStore;
  let watcher: FSWatcher | undefined;

  beforeEach(async () => {
    write.mockReset().mockImplementation((file: string, content: string) => fileSystem.writeFile(file, content));
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-selection-save-"));
    await Promise.all([
      fs.writeFile(path.join(root, "a.md"), "disk a"),
      fs.writeFile(path.join(root, "b.md"), "disk b")
    ]);
    useWorkspaceStore.setState({ workspacePath: root, isLoading: false });
    state = {
      notes: [
        { id: "a.md", title: "a", content: "disk a", filePath: path.join(root, "a.md") },
        { id: "b.md", title: "b", content: "disk b", filePath: path.join(root, "b.md") }
      ],
      selectedNoteId: "a.md",
      editorContent: "disk a",
      savingNoteIds: new Set(),
      openNoteIds: ["a.md"],
      playingNoteIds: []
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
    setLastSavedContent("a.md", "disk a");
    setLastSavedContent("b.md", "disk b");
  });

  afterEach(async () => {
    clearAllDebouncedSaves();
    for (const note of state.notes) clearPendingSave(note.id);
    await watcher?.close();
    watcher = undefined;
    await fs.rm(root, { recursive: true, force: true });
  });

  it("does not write a clean editor over an external draft while chokidar is stabilizing it", async () => {
    const seen: string[] = [];
    watcher = chokidar.watch(root, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 }
    });
    watcher.on("change", (file) => seen.push(file));
    await new Promise<void>((resolve, reject) => {
      watcher!.once("ready", resolve);
      watcher!.once("error", reject);
    });
    await fs.writeFile(path.join(root, "a.md"), "external draft");
    expect(seen).toEqual([]);
    state.selectNote("b.md");
    await flushAllDebouncedSaves(() => state);
    expect(write).not.toHaveBeenCalled();
    expect(await fs.readFile(path.join(root, "a.md"), "utf8")).toBe("external draft");
    await vi.waitFor(() => expect(seen).toContain(path.join(root, "a.md")));
  });

  it("still flushes a locally edited draft when switching", async () => {
    state.updateNoteContent("local draft");
    state.selectNote("b.md");
    await flushAllDebouncedSaves(() => state);
    expect(await fs.readFile(path.join(root, "a.md"), "utf8")).toBe("local draft");
    expect(hasPendingSave(path.join(root, "a.md"))).toBe(false);
  });

  it("commits an explicit revert even if its text again equals the previous saved baseline", async () => {
    state.updateNoteContent("temporary draft");
    state.updateNoteContent("disk a");
    state.selectNote("b.md");
    await flushAllDebouncedSaves(() => state);
    expect(write).toHaveBeenCalledWith(path.join(root, "a.md"), "disk a", "disk a");
  });
});
