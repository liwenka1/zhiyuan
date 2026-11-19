import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { harness, push, scan, write, settings, ready } = vi.hoisted(() => ({
  harness: {
    state: null as unknown as NoteStore,
    effects: [] as Array<() => unknown>,
    refs: [] as unknown[],
    refIndex: 0,
    close: null as null | ((token: number) => void)
  },
  push: vi.fn(),
  scan: vi.fn(),
  write: vi.fn(),
  ready: vi.fn(),
  settings: { owner: "owner", repo: "repo", activeProjectKey: "project", isLoaded: true }
}));

vi.mock("electron", () => ({ BrowserWindow: class {}, dialog: {}, shell: {} }));
vi.mock("../../apps/desktop/src/main/config", () => ({ configManager: {} }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => unknown) => harness.effects.push(effect),
  useRef: (value: unknown) => {
    const index = harness.refIndex++;
    harness.refs[index] ??= { current: value };
    return harness.refs[index];
  }
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
  workspaceIpc: { scan },
  fileIpc: { write, exists: vi.fn().mockResolvedValue(false) },
  folderIpc: {},
  watcherIpc: { pause: vi.fn(), resume: vi.fn() },
  configIpc: { getPinnedNotes: vi.fn().mockResolvedValue([]), setPinnedNotes: vi.fn() },
  shellIpc: {}
}));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { workspaceManager } from "../../apps/desktop/src/main/workspace";
import { useWorkspaceStore } from "../../apps/desktop/src/renderer/src/stores/use-workspace-store";
import { useFolderStore } from "../../apps/desktop/src/renderer/src/stores/use-folder-store";
import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";
import { createLoaders } from "../../apps/desktop/src/renderer/src/stores/note-store/loaders";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";
import { useOperationStore } from "../../apps/desktop/src/renderer/src/stores/note-store/operation-guard";
import { useNoteHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-note-handlers";
import { useWorkspaceInit } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-workspace-init";
import { useWindowClose } from "../../apps/desktop/src/renderer/src/hooks/use-window-close";
import { parseGitHubMetadata } from "../../apps/desktop/src/renderer/src/lib/github-metadata";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((finish, fail) => {
    resolve = finish;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const published = { issueNumber: 12, issueUrl: "https://github.com/owner/repo/issues/12", isNew: true };
const handlers = () => useNoteHandlers({ onOpenRenameDialog: vi.fn(), onOpenCreateNoteDialog: vi.fn() });

function renderInit() {
  harness.effects = [];
  harness.refIndex = 0;
  useWorkspaceInit();
}

async function loadCurrentWorkspace() {
  renderInit();
  harness.effects[0]();
  await vi.waitFor(() => expect(useWorkspaceStore.getState().isLoading).toBe(false));
}

describe("publishing before committing a workspace transition", () => {
  let tempRoot: string;
  let rootA: string;
  let rootB: string;
  let rootC: string;
  let boundRoot: string | null;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-publication-switch-"));
    [rootA, rootB, rootC] = ["a", "b", "c"].map((name) => path.join(tempRoot, name));
    await Promise.all(
      [rootA, rootB, rootC].map(async (root) => {
        await fs.mkdir(root);
        await fs.writeFile(path.join(root, "note.md"), `original ${path.basename(root)}`);
      })
    );
    harness.refs = [];
    harness.refIndex = 0;
    harness.close = null;
    harness.state = {
      notes: [],
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
    Object.assign(harness.state, createNoteActions(set, get), applyPersistence(set, get), createLoaders(set, get));
    boundRoot = null;
    write.mockReset().mockImplementation((file: string, content: string) => {
      if (!boundRoot || !file.startsWith(`${boundRoot}${path.sep}`))
        throw new Error("write outside currently bound workspace");
      return fileSystem.writeFile(file, content);
    });
    scan.mockReset().mockImplementation(async (root: string) => {
      const data = await workspaceManager.scanWorkspace(root);
      boundRoot = root;
      return data;
    });
    push.mockReset().mockResolvedValue(published);
    ready.mockReset().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", {
      setTimeout,
      api: {
        window: {
          onPrepareClose: (callback: (token: number) => void) => {
            harness.close = callback;
            return vi.fn();
          },
          readyToClose: ready
        }
      }
    });
    useWorkspaceStore.setState({ workspacePath: null, isLoading: false, pendingFilePath: null });
    useFolderStore.setState({ folders: [], selectedFolderId: null });
    await useWorkspaceStore.getState().setWorkspacePath(rootA);
    await loadCurrentWorkspace();
    harness.state.selectNote("note.md");
  });

  afterEach(async () => {
    clearAllDebouncedSaves();
    for (const note of harness.state.notes) clearPendingSave(note.id);
    vi.unstubAllGlobals();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("saves A's association before B becomes current, then updates the same issue after scanning A again", async () => {
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const switching = useWorkspaceStore.getState().setWorkspacePath(rootB);
    const beforeResponse = useWorkspaceStore.getState().workspacePath;
    harness.state.updateNoteContent("edited A while the response was pending");
    response.resolve(published);
    await publishing;
    await switching;
    expect(beforeResponse).toBe(rootA);
    expect(parseGitHubMetadata(await fs.readFile(path.join(rootA, "note.md"), "utf8"))).toMatchObject({
      issueNumber: 12
    });
    await loadCurrentWorkspace();
    expect(harness.state.notes[0]).toMatchObject({ content: "original b", filePath: path.join(rootB, "note.md") });
    expect(await fs.readFile(path.join(rootB, "note.md"), "utf8")).toBe("original b");
    await useWorkspaceStore.getState().setWorkspacePath(rootA);
    await loadCurrentWorkspace();
    await handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(push.mock.calls[0][0].issueNumber).toBeUndefined();
    expect(push.mock.calls[1][0].issueNumber).toBe(12);
    expect(harness.state.notes[0].content).toContain("edited A while the response was pending");
  });

  it("keeps only the latest deferred workspace and its pending file request", async () => {
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    useWorkspaceStore.getState().setPendingFilePath(path.join(rootB, "note.md"));
    const toB = useWorkspaceStore.getState().setWorkspacePath(rootB);
    useWorkspaceStore.getState().setPendingFilePath(path.join(rootC, "note.md"));
    const toC = useWorkspaceStore.getState().setWorkspacePath(rootC);
    const whilePublishing = useWorkspaceStore.getState().workspacePath;
    response.resolve(published);
    await publishing;
    await Promise.all([toB, toC]);
    expect(whilePublishing).toBe(rootA);
    expect(useWorkspaceStore.getState().workspacePath).toBe(rootC);
    expect(useWorkspaceStore.getState().pendingFilePath).toBe(path.join(rootC, "note.md"));
    await loadCurrentWorkspace();
    renderInit();
    harness.effects[1]();
    await vi.waitFor(() => expect(harness.state.selectedNoteId).toBe("note.md"));
    expect(harness.state.notes[0].filePath).toBe(path.join(rootC, "note.md"));
    expect(scan.mock.calls.map(([root]) => root)).not.toContain(rootB);
  });

  it("keeps a nested workspace's file request away from A until the deferred switch commits", async () => {
    rootB = path.join(rootA, "nested");
    await fs.mkdir(rootB);
    await fs.writeFile(path.join(rootB, "note.md"), "nested B original");
    await loadCurrentWorkspace();
    expect(harness.state.notes.some((note) => note.id === "nested/note.md")).toBe(true);
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const target = path.join(rootB, "note.md");
    useWorkspaceStore.getState().setPendingFilePath(target);
    const switching = useWorkspaceStore.getState().setWorkspacePath(rootB);
    renderInit();
    harness.effects[1]();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootA, pendingFilePath: null });
    expect(harness.state.selectedNoteId).toBe("note.md");
    response.resolve(published);
    await publishing;
    await switching;
    expect(useWorkspaceStore.getState().pendingFilePath).toBe(target);
    await loadCurrentWorkspace();
    renderInit();
    harness.effects[1]();
    await vi.waitFor(() => expect(harness.state.selectedNoteId).toBe("note.md"));
    expect(harness.state.notes[0]).toMatchObject({ filePath: target, content: "nested B original" });
    expect(useWorkspaceStore.getState().pendingFilePath).toBeNull();
    expect(parseGitHubMetadata(await fs.readFile(path.join(rootA, "note.md"), "utf8"))).toMatchObject({
      issueNumber: 12
    });
  });

  it("waits for metadata I/O, then flushes newer A input before binding B", async () => {
    const writing = deferred<void>();
    write.mockImplementationOnce(async (file: string, content: string) => {
      expect(boundRoot).toBe(rootA);
      await writing.promise;
      await fileSystem.writeFile(file, content);
    });
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const switching = useWorkspaceStore.getState().setWorkspacePath(rootB);
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootA, isLoading: false });
    const latest = `${harness.state.editorContent}\nnew input during metadata I/O`;
    harness.state.updateNoteContent(latest);
    writing.resolve();
    await publishing;
    await switching;
    await loadCurrentWorkspace();
    expect(await fs.readFile(path.join(rootA, "note.md"), "utf8")).toBe(latest);
    expect(parseGitHubMetadata(latest)).toMatchObject({ issueNumber: 12 });
    expect(boundRoot).toBe(rootB);
    expect(await fs.readFile(path.join(rootB, "note.md"), "utf8")).toBe("original b");
  });

  it("cancels a queued switch by selecting A again and clears B's pending file", async () => {
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    useWorkspaceStore.getState().setPendingFilePath(path.join(rootB, "note.md"));
    const toB = useWorkspaceStore.getState().setWorkspacePath(rootB);
    await useWorkspaceStore.getState().setWorkspacePath(rootA);
    response.resolve(published);
    await publishing;
    await toB;
    expect(useWorkspaceStore.getState()).toMatchObject({
      workspacePath: rootA,
      isLoading: false,
      pendingFilePath: null
    });
    expect(parseGitHubMetadata(await fs.readFile(path.join(rootA, "note.md"), "utf8"))).toMatchObject({
      issueNumber: 12
    });
  });

  it("does not permanently defer switching after a publication request fails", async () => {
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const toB = useWorkspaceStore.getState().setWorkspacePath(rootB);
    response.reject(new Error("remote unavailable"));
    await publishing;
    await toB;
    await loadCurrentWorkspace();
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootB, isLoading: false });
    await handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(push).toHaveBeenCalledTimes(2);
  });

  it("retries a failed metadata commit while A is still bound before loading B", async () => {
    write.mockRejectedValueOnce(new Error("temporary disk failure"));
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const switching = useWorkspaceStore.getState().setWorkspacePath(rootB);
    await publishing;
    await switching;
    await loadCurrentWorkspace();
    expect(parseGitHubMetadata(await fs.readFile(path.join(rootA, "note.md"), "utf8"))).toMatchObject({
      issueNumber: 12
    });
    expect(boundRoot).toBe(rootB);
    await useWorkspaceStore.getState().setWorkspacePath(rootA);
    await loadCurrentWorkspace();
    await handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(push.mock.calls[1][0].issueNumber).toBe(12);
  });

  it("can finish publishing, a requested workspace switch and a close handshake without a wait cycle", async () => {
    const response = deferred<typeof published>();
    push.mockReturnValueOnce(response.promise);
    const publishing = handlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const toB = Promise.resolve(useWorkspaceStore.getState().setWorkspacePath(rootB)).then(loadCurrentWorkspace);
    harness.effects = [];
    useWindowClose();
    harness.effects[0]();
    harness.close!(17);
    response.resolve(published);
    await publishing;
    await toB;
    await vi.waitFor(() => expect(ready).toHaveBeenCalledWith(17));
    expect(parseGitHubMetadata(await fs.readFile(path.join(rootA, "note.md"), "utf8"))).toMatchObject({
      issueNumber: 12
    });
    expect(useOperationStore.getState().closeRequestCount).toBe(0);
  });

  it("does not delay or weaken the synchronous loading lock when no publication is running", async () => {
    const switching = useWorkspaceStore.getState().setWorkspacePath(rootB);
    expect(useWorkspaceStore.getState()).toMatchObject({ workspacePath: rootB, isLoading: true });
    await switching;
    await loadCurrentWorkspace();
    expect(harness.state.notes[0].content).toBe("original b");
  });
});
