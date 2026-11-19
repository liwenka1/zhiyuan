import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { harness, push, write, rename, pins, settings } = vi.hoisted(() => ({
  harness: { state: null as unknown as NoteStore },
  push: vi.fn(),
  write: vi.fn(),
  rename: vi.fn(),
  pins: vi.fn(),
  settings: { owner: "owner", repo: "repo", activeProjectKey: "project", isLoaded: true }
}));

vi.mock("@/stores/note-store", () => ({
  useNoteStore: Object.assign((select: (state: NoteStore) => unknown) => select(harness.state), {
    getState: () => harness.state,
    setState: (update: ((state: NoteStore) => Partial<NoteStore>) | Partial<NoteStore>) =>
      Object.assign(harness.state, typeof update === "function" ? update(harness.state) : update)
  })
}));
vi.mock("@/stores", async () => {
  const { useWorkspaceStore } = await import("../../apps/desktop/src/renderer/src/stores/use-workspace-store");
  const { useNoteStore } = await import("@/stores/note-store");
  return {
    useNoteStore,
    useWorkspaceStore: Object.assign(
      (select: (state: ReturnType<typeof useWorkspaceStore.getState>) => unknown) =>
        select(useWorkspaceStore.getState()),
      { getState: useWorkspaceStore.getState }
    ),
    useGitHubSettingsStore: { getState: () => settings }
  };
});
vi.mock("@/features/export", () => ({ useNoteExport: () => ({ exportNote: vi.fn(), copyToWechat: vi.fn() }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("@/lib/markdown-assets", () => ({ collectLocalMarkdownAssets: () => [], replaceMarkdownAssetUrls: vi.fn() }));
vi.mock("@/lib/github-assets", () => ({ uploadMarkdownAssets: vi.fn() }));
vi.mock("@/ipc", () => ({
  githubIpc: { pushIssue: push },
  fileIpc: {
    write,
    read: async (file: string) => ({ content: await fs.readFile(file, "utf8") }),
    rename,
    exists: vi.fn().mockResolvedValue(false)
  },
  folderIpc: { rename },
  watcherIpc: { pause: vi.fn(), resume: vi.fn() },
  configIpc: { setPinnedNotes: pins },
  shellIpc: {}
}));

import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";
import { isPublishingPath } from "../../apps/desktop/src/renderer/src/stores/note-store/operation-guard";
import { useNoteHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-note-handlers";
import { parseGitHubMetadata } from "../../apps/desktop/src/renderer/src/lib/github-metadata";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => (resolve = finish));
  return { promise, resolve };
}

const published = { issueNumber: 12, issueUrl: "https://github.com/owner/repo/issues/12", isNew: true };
const handlers = () => useNoteHandlers({ onOpenRenameDialog: vi.fn(), onOpenCreateNoteDialog: vi.fn() });
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

describe("publication source identity and persistence", () => {
  let root: string;
  let filePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-publication-"));
    filePath = path.join(root, "notes", "note.md");
    await fs.mkdir(path.dirname(filePath));
    await fs.mkdir(path.join(root, "dest"));
    await fs.writeFile(filePath, "original");
    useWorkspaceStore.setState({ workspacePath: root, isLoading: false });
    useFolderStore.setState({
      folders: [
        { id: "notes", name: "notes", path: path.join(root, "notes") },
        { id: "dest", name: "dest", path: path.join(root, "dest") }
      ],
      selectedFolderId: "notes"
    });
    harness.state = {
      notes: [
        { id: "notes/note.md", title: "note", fileName: "note.md", filePath, folderId: "notes", content: "original" }
      ],
      selectedNoteId: "notes/note.md",
      editorContent: "original",
      openNoteIds: ["notes/note.md"],
      playingNoteIds: [],
      savingNoteIds: new Set(),
      isLoadingFromFileSystem: false
    } as unknown as NoteStore;
    const get = () => harness.state;
    const set: NoteStoreSet = (update) => {
      if (typeof update === "function") update(harness.state);
      else Object.assign(harness.state, update);
    };
    Object.assign(harness.state, createNoteActions(set, get), applyPersistence(set, get));
    setLastSavedContent("notes/note.md", "original");
    write.mockReset().mockImplementation((file: string, content: string) => fs.writeFile(file, content));
    rename.mockReset().mockImplementation((oldPath: string, newPath: string) => fs.rename(oldPath, newPath));
    push.mockReset().mockResolvedValue(published);
  });

  afterEach(async () => {
    clearAllDebouncedSaves();
    for (const note of harness.state.notes) clearPendingSave(note.id);
    await fs.rm(root, { recursive: true, force: true });
  });

  it.each(["rename", "move", "rename-folder"] as const)(
    "blocks %s of the publication source and then updates the same issue on the next publish",
    async (operation) => {
      const response = deferred<typeof published>();
      push.mockReturnValueOnce(response.promise);
      const publishing = handlers().handlePushToGitHub({ id: "notes/note.md", title: "note" });
      expect(isPublishingPath(root, filePath)).toBe(true);
      if (operation === "rename") await harness.state.renameNote("notes/note.md", "renamed");
      else if (operation === "move") await harness.state.moveNote("notes/note.md", "dest");
      else await useFolderStore.getState().renameFolder("notes", "renamed");
      expect(rename).not.toHaveBeenCalled();
      expect(harness.state.notes[0].filePath).toBe(filePath);
      response.resolve(published);
      await publishing;
      expect(parseGitHubMetadata(await fs.readFile(filePath, "utf8"))).toMatchObject({ issueNumber: 12 });
      await handlers().handlePushToGitHub({ id: "notes/note.md", title: "note" });
      expect(push.mock.calls[1][0].issueNumber).toBe(12);
      if (operation === "rename") await harness.state.renameNote("notes/note.md", "renamed");
      else if (operation === "move") await harness.state.moveNote("notes/note.md", "dest");
      else await useFolderStore.getState().renameFolder("notes", "renamed");
      expect(rename).toHaveBeenCalledOnce();
      expect(harness.state.notes[0].github).toMatchObject({ issueNumber: 12 });
    }
  );

  it("ignores a concurrent create and releases the lease only after the metadata write finishes", async () => {
    const writing = deferred<void>();
    write.mockImplementationOnce(async (file: string, content: string) => {
      await writing.promise;
      await fs.writeFile(file, content);
    });
    const first = handlers().handlePushToGitHub({ id: "notes/note.md", title: "note" });
    await settle();
    expect(write).toHaveBeenCalledOnce();
    await handlers().handlePushToGitHub({ id: "notes/note.md", title: "note" });
    expect(push).toHaveBeenCalledOnce();
    expect(isPublishingPath(root, filePath)).toBe(true);
    writing.resolve();
    await first;
    expect(isPublishingPath(root, filePath)).toBe(false);
    expect(parseGitHubMetadata(await fs.readFile(filePath, "utf8"))).toMatchObject({ issueNumber: 12 });
  });

  it("retains edits queued while the metadata save is in flight", async () => {
    const writing = deferred<void>();
    write.mockImplementationOnce(async (file: string, content: string) => {
      await writing.promise;
      await fs.writeFile(file, content);
    });
    const publishing = handlers().handlePushToGitHub({ id: "notes/note.md", title: "note" });
    await settle();
    const edited = harness.state.editorContent + "\nlocal edit while writing";
    harness.state.updateNoteContent(edited);
    writing.resolve();
    await publishing;
    await flushAllDebouncedSaves(() => harness.state);
    expect(await fs.readFile(filePath, "utf8")).toBe(edited);
    expect(harness.state.editorContent).toBe(edited);
    expect(parseGitHubMetadata(edited)).toMatchObject({ issueNumber: 12 });
  });
});
