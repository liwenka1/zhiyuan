import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleFileChangedMock, getLastSavedContentMock, setLastSavedContentMock, warningMock, workspaceState } =
  vi.hoisted(() => ({
    handleFileChangedMock: vi.fn(),
    getLastSavedContentMock: vi.fn(),
    setLastSavedContentMock: vi.fn(),
    warningMock: vi.fn(),
    workspaceState: { workspacePath: "/workspace" }
  }));

vi.mock("@/lib/file-watcher", () => ({
  handleFileChanged: handleFileChangedMock,
  handleFileAdded: vi.fn()
}));

vi.mock("@/lib/github-metadata", () => ({
  parseGitHubMetadata: vi.fn(() => undefined)
}));

vi.mock("@/lib/i18n", () => ({
  default: { t: (key: string) => key }
}));

vi.mock("sonner", () => ({
  toast: { warning: warningMock }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspaceState }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ folders: [], setFolders: vi.fn() }) }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearPendingSave: vi.fn(),
  getLastSavedContent: getLastSavedContentMock,
  setLastSavedContent: setLastSavedContentMock,
  wasRecentlySaved: vi.fn(() => false)
}));

import { createFileEventHandlers } from "../../apps/desktop/src/renderer/src/stores/note-store/file-events";

type FileEventState = {
  notes: Array<{
    id: string;
    filePath: string;
    content: string;
    updatedAt: string;
    folderId: string | null;
    isPinned: boolean;
  }>;
  selectedNoteId: string | null;
  editorContent: string;
  savingNoteIds: Set<string>;
};

function createTestStore() {
  const state: FileEventState = {
    notes: [
      {
        id: "note.md",
        filePath: "/workspace/note.md",
        content: "old",
        updatedAt: "2024-01-01T00:00:00.000Z",
        folderId: null,
        isPinned: false
      }
    ],
    selectedNoteId: null,
    editorContent: "",
    savingNoteIds: new Set<string>()
  };
  const set = (update: ((state: FileEventState) => void) | Partial<FileEventState>) => {
    if (typeof update === "function") update(state);
    else Object.assign(state, update);
  };
  const get = () => state;
  return { state, get, handlers: createFileEventHandlers(set as never, get as never) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("file watcher event handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceState.workspacePath = "/workspace";
    getLastSavedContentMock.mockReturnValue("old");
  });

  it("applies an externally emptied markdown file", async () => {
    handleFileChangedMock.mockResolvedValue("");
    const { state, handlers } = createTestStore();

    await handlers.handleFileChangedEvent("note.md", "/workspace/note.md");

    expect(state.notes[0].content).toBe("");
    expect(setLastSavedContentMock).toHaveBeenCalledWith("note.md", "");
  });

  it("preserves edits made while an external file read is pending", async () => {
    const read = deferred<string>();
    handleFileChangedMock.mockReturnValue(read.promise);
    const { state, handlers } = createTestStore();
    state.selectedNoteId = "note.md";
    state.editorContent = "old";

    const update = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    state.notes[0].content = "local draft";
    state.editorContent = "local draft";
    read.resolve("external content");
    await update;

    expect(state.notes[0].content).toBe("local draft");
    expect(state.editorContent).toBe("local draft");
    expect(setLastSavedContentMock).not.toHaveBeenCalled();
    expect(warningMock).toHaveBeenCalled();
  });

  it("preserves edits made to a background note during the read", async () => {
    const read = deferred<string>();
    handleFileChangedMock.mockReturnValue(read.promise);
    const { state, handlers } = createTestStore();

    const update = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    state.notes[0].content = "background draft";
    read.resolve("external content");
    await update;

    expect(state.notes[0].content).toBe("background draft");
    expect(setLastSavedContentMock).not.toHaveBeenCalled();
  });

  it("ignores an old read after switching workspaces with the same relative note ID", async () => {
    const read = deferred<string>();
    handleFileChangedMock.mockReturnValue(read.promise);
    const { state, handlers } = createTestStore();

    const update = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    workspaceState.workspacePath = "/other-workspace";
    state.notes[0] = { ...state.notes[0], filePath: "/other-workspace/note.md", content: "other note" };
    read.resolve("old workspace content");
    await update;

    expect(state.notes[0].content).toBe("other note");
    expect(setLastSavedContentMock).not.toHaveBeenCalled();
  });

  it("ignores an old read after the note is renamed or moved", async () => {
    const read = deferred<string>();
    handleFileChangedMock.mockReturnValue(read.promise);
    const { state, handlers } = createTestStore();

    const update = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    state.notes[0].filePath = "/workspace/moved/note.md";
    read.resolve("old path content");
    await update;

    expect(state.notes[0].content).toBe("old");
    expect(setLastSavedContentMock).not.toHaveBeenCalled();
  });

  it("does not let an older read overwrite a newer external change", async () => {
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    handleFileChangedMock.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise);
    const { state, handlers } = createTestStore();

    const firstUpdate = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    const secondUpdate = handlers.handleFileChangedEvent("note.md", "/workspace/note.md");
    secondRead.resolve("newest external content");
    await secondUpdate;
    firstRead.resolve("stale external content");
    await firstUpdate;

    expect(state.notes[0].content).toBe("newest external content");
    expect(setLastSavedContentMock).toHaveBeenCalledTimes(1);
  });

  it("does not read over existing unsaved edits in a background note", async () => {
    const { state, handlers } = createTestStore();
    state.notes[0].content = "unsaved background draft";

    await handlers.handleFileChangedEvent("note.md", "/workspace/note.md");

    expect(handleFileChangedMock).not.toHaveBeenCalled();
    expect(state.notes[0].content).toBe("unsaved background draft");
  });
});
