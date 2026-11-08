import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { setPinnedNotesMock, toastErrorMock } = vi.hoisted(() => ({
  setPinnedNotesMock: vi.fn(),
  toastErrorMock: vi.fn()
}));

vi.mock("@/ipc", () => ({
  configIpc: { setPinnedNotes: setPinnedNotesMock },
  fileIpc: {},
  watcherIpc: {}
}));

vi.mock("@/lib/formatter", () => ({ formatMarkdown: vi.fn() }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => ({ workspacePath: "/workspace" }) }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ selectedFolderId: null, folders: [] }) }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearDebouncedSave: vi.fn(),
  clearPendingSave: vi.fn(),
  setLastSavedContent: vi.fn()
}));

let createNoteActions: typeof import("../../apps/desktop/src/renderer/src/stores/note-store/actions").createNoteActions;

beforeAll(async () => {
  ({ createNoteActions } = await import("../../apps/desktop/src/renderer/src/stores/note-store/actions"));
});

function createStore() {
  type NoteActionState = {
    notes: Array<{
      id: string;
      title: string;
      fileName: string;
      filePath: string;
      content: string;
      isPinned: boolean;
    }>;
    selectedNoteId: string | null;
    editorContent: string;
    openNoteIds: string[];
    playingNoteIds: string[];
    savingNoteIds: Set<string>;
  };
  const state: NoteActionState = {
    notes: [
      {
        id: "note.md",
        title: "note",
        fileName: "note.md",
        filePath: "/workspace/note.md",
        content: "content",
        isPinned: false
      }
    ],
    selectedNoteId: null,
    editorContent: "",
    openNoteIds: [],
    playingNoteIds: [],
    savingNoteIds: new Set<string>()
  };
  const set = (update: ((state: NoteActionState) => void) | Partial<NoteActionState>) => {
    if (typeof update === "function") update(state);
    else Object.assign(state, update);
  };
  const get = () => state;
  return { state, actions: createNoteActions(set as never, get as never) };
}

describe("note action persistence", () => {
  beforeEach(() => {
    setPinnedNotesMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("rolls back an optimistic pin when persistence fails", async () => {
    setPinnedNotesMock.mockRejectedValueOnce(new Error("config unavailable"));
    const { state, actions } = createStore();

    await expect(actions.togglePinNote("note.md")).rejects.toThrow("config unavailable");

    expect(state.notes[0].isPinned).toBe(false);
    expect(toastErrorMock).toHaveBeenCalled();
  });
});
