import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteStore, NoteStoreSet } from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { formatMock, workspaceState } = vi.hoisted(() => ({
  formatMock: vi.fn(),
  workspaceState: { workspacePath: "/workspace" }
}));

vi.mock("@/ipc", () => ({ configIpc: {}, fileIpc: {}, watcherIpc: {} }));
vi.mock("@/lib/formatter", () => ({ formatMarkdown: formatMock }));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspaceState }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-folder-store", () => ({
  useFolderStore: { getState: () => ({ folders: [], selectedFolderId: null }) }
}));
vi.mock("../../apps/desktop/src/renderer/src/stores/note-store/persistence", () => ({
  clearDebouncedSave: vi.fn(),
  clearPendingSave: vi.fn(),
  setLastSavedContent: vi.fn()
}));

import { createNoteActions } from "../../apps/desktop/src/renderer/src/stores/note-store/actions";

function createStore() {
  const updateContent = vi.fn((content: string) => {
    state.editorContent = content;
    const selected = state.notes.find((note) => note.id === state.selectedNoteId);
    if (selected) selected.content = content;
  });
  const state = {
    notes: [
      { id: "a.md", title: "a", filePath: "/workspace/a.md", content: "A original" },
      { id: "b.md", title: "b", filePath: "/workspace/b.md", content: "B original" }
    ],
    selectedNoteId: "a.md",
    editorContent: "A original",
    updateNoteContent: updateContent
  };
  const get = () => state as unknown as NoteStore;
  const set: NoteStoreSet = (update) => {
    if (typeof update === "function") update(get());
    else Object.assign(state, update);
  };
  return { state, updateContent, actions: createNoteActions(set, get) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => (resolve = resolvePromise));
  return { promise, resolve };
}

describe("async note formatting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    workspaceState.workspacePath = "/workspace";
  });

  it("applies formatting when the original note is still selected and unchanged", async () => {
    formatMock.mockResolvedValue("A formatted");
    const { state, updateContent, actions } = createStore();

    await actions.formatCurrentNote();

    expect(updateContent).toHaveBeenCalledWith("A formatted");
    expect(state.editorContent).toBe("A formatted");
  });

  it("does not apply note A's formatted content to note B after selection changes", async () => {
    const formatting = deferred<string>();
    formatMock.mockReturnValue(formatting.promise);
    const { state, updateContent, actions } = createStore();
    const operation = actions.formatCurrentNote();

    state.selectedNoteId = "b.md";
    state.editorContent = "B original";
    formatting.resolve("A formatted");
    await operation;

    expect(updateContent).not.toHaveBeenCalled();
    expect(state.notes[1].content).toBe("B original");
    expect(state.editorContent).toBe("B original");
  });

  it("preserves input made while formatting is pending", async () => {
    const formatting = deferred<string>();
    formatMock.mockReturnValue(formatting.promise);
    const { state, updateContent, actions } = createStore();
    const operation = actions.formatCurrentNote();

    state.notes[0].content = "A new draft";
    state.editorContent = "A new draft";
    formatting.resolve("A formatted");
    await operation;

    expect(updateContent).not.toHaveBeenCalled();
    expect(state.editorContent).toBe("A new draft");
  });

  it("ignores an old formatting result after a workspace change", async () => {
    const formatting = deferred<string>();
    formatMock.mockReturnValue(formatting.promise);
    const { state, updateContent, actions } = createStore();
    const operation = actions.formatCurrentNote();

    workspaceState.workspacePath = "/other";
    state.notes[0] = { ...state.notes[0], filePath: "/other/a.md" };
    formatting.resolve("A formatted");
    await operation;

    expect(updateContent).not.toHaveBeenCalled();
  });
});
