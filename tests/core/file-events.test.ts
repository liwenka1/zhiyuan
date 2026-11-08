import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleFileChangedMock, setLastSavedContentMock } = vi.hoisted(() => ({
  handleFileChangedMock: vi.fn(),
  setLastSavedContentMock: vi.fn()
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
  toast: { warning: vi.fn() }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => ({ workspacePath: "/workspace" }) }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ folders: [], setFolders: vi.fn() }) }
}));

vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearPendingSave: vi.fn(),
  getLastSavedContent: vi.fn(),
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

describe("file watcher event handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies an externally emptied markdown file", async () => {
    handleFileChangedMock.mockResolvedValue("");
    const { state, handlers } = createTestStore();

    await handlers.handleFileChangedEvent("note.md", "/workspace/note.md");

    expect(state.notes[0].content).toBe("");
    expect(setLastSavedContentMock).toHaveBeenCalledWith("note.md", "");
  });
});
