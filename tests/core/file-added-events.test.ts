import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";
import type {
  NoteStore,
  NoteStoreSet,
  NoteStoreState
} from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { readAddedMock, clearPendingMock, setSavedMock, warningMock, workspaceState } = vi.hoisted(() => ({
  readAddedMock: vi.fn(),
  clearPendingMock: vi.fn(),
  setSavedMock: vi.fn(),
  warningMock: vi.fn(),
  workspaceState: { workspacePath: "/workspace" }
}));

vi.mock("@/lib/file-watcher", () => ({ handleFileAdded: readAddedMock, handleFileChanged: vi.fn() }));
vi.mock("@/lib/github-metadata", () => ({ parseGitHubMetadata: () => undefined }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { warning: warningMock } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspaceState }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ folders: [], setFolders: vi.fn() }) }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearPendingSave: clearPendingMock,
  getLastSavedContent: () => "saved",
  setLastSavedContent: setSavedMock,
  recordSaveConflict: vi.fn(),
  hasPendingSave: () => false,
  isOwnSaveContent: () => false
}));

import { createFileEventHandlers } from "../../apps/desktop/src/renderer/src/stores/note-store/file-events";

function note(content = "saved"): Note {
  return { id: "note.md", title: "note", filePath: "/workspace/note.md", content };
}

function createStore(notes: Note[] = []) {
  const state: NoteStoreState = {
    notes,
    selectedNoteId: null,
    editorContent: "",
    openNoteIds: notes.map((item) => item.id),
    playingNoteIds: [],
    savingNoteIds: new Set(),
    isLoadingFromFileSystem: false
  };
  const get = () => state as NoteStore;
  const set: NoteStoreSet = (update) => {
    if (typeof update === "function") update(get());
    else Object.assign(state, update);
  };
  return { state, handlers: createFileEventHandlers(set, get) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => (resolve = resolvePromise));
  return { promise, resolve };
}

describe("external note additions and deletions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    workspaceState.workspacePath = "/workspace";
  });

  it("adds a newly read note once", async () => {
    const { state, handlers } = createStore();
    readAddedMock.mockResolvedValue(note());

    await handlers.handleFileAddedEvent("note.md", "/workspace/note.md");

    expect(state.notes).toEqual([note()]);
    expect(setSavedMock).toHaveBeenCalledWith("note.md", "saved");
  });

  it("ignores an addition read that completes after switching workspaces", async () => {
    const read = deferred<Note>();
    readAddedMock.mockReturnValue(read.promise);
    const { state, handlers } = createStore();
    const operation = handlers.handleFileAddedEvent("note.md", "/workspace/note.md");

    workspaceState.workspacePath = "/other";
    read.resolve(note());
    await operation;

    expect(state.notes).toEqual([]);
    expect(setSavedMock).not.toHaveBeenCalled();
  });

  it("does not duplicate a note already supplied by a scan during the read", async () => {
    const read = deferred<Note>();
    readAddedMock.mockReturnValue(read.promise);
    const { state, handlers } = createStore();
    const operation = handlers.handleFileAddedEvent("note.md", "/workspace/note.md");

    state.notes.push(note("new scan content"));
    read.resolve(note("old read content"));
    await operation;

    expect(state.notes).toEqual([note("new scan content")]);
    expect(setSavedMock).not.toHaveBeenCalled();
  });

  it("does not resurrect a file deleted before its addition read finishes", async () => {
    const read = deferred<Note>();
    readAddedMock.mockReturnValue(read.promise);
    const { state, handlers } = createStore();
    const operation = handlers.handleFileAddedEvent("note.md", "/workspace/note.md");

    handlers.handleFileDeletedEvent("note.md");
    read.resolve(note());
    await operation;

    expect(state.notes).toEqual([]);
    expect(setSavedMock).not.toHaveBeenCalled();
  });

  it("preserves an unselected dirty draft on external deletion", () => {
    const { state, handlers } = createStore([note("unsaved background draft")]);

    handlers.handleFileDeletedEvent("note.md");

    expect(state.notes).toEqual([note("unsaved background draft")]);
    expect(clearPendingMock).not.toHaveBeenCalled();
    expect(warningMock).toHaveBeenCalled();
  });

  it("removes a clean background note on external deletion", () => {
    const { state, handlers } = createStore([note()]);

    handlers.handleFileDeletedEvent("note.md");

    expect(state.notes).toEqual([]);
    expect(clearPendingMock).toHaveBeenCalledWith("note.md");
  });
});
