import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";
import type {
  NoteStore,
  NoteStoreSet,
  NoteStoreState
} from "../../apps/desktop/src/renderer/src/stores/note-store/types";

const { getPinnedNotesMock, writeMock, workspaceState } = vi.hoisted(() => ({
  getPinnedNotesMock: vi.fn(),
  writeMock: vi.fn(),
  workspaceState: { workspacePath: "/workspace" }
}));

vi.mock("@/ipc", () => ({
  configIpc: { getPinnedNotes: getPinnedNotesMock },
  fileIpc: { write: writeMock }
}));
vi.mock("@/lib/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/lib/github-metadata", () => ({ parseGitHubMetadata: () => undefined }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../apps/desktop/src/renderer/src/stores/use-workspace-store", () => ({
  useWorkspaceStore: { getState: () => workspaceState }
}));

import { createLoaders } from "../../apps/desktop/src/renderer/src/stores/note-store/loaders";
import {
  applyPersistence,
  clearAllDebouncedSaves,
  clearPendingSave,
  flushAllDebouncedSaves,
  getLastSavedContent,
  setLastSavedContent
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";

function note(id = "note.md", content = "disk content"): Note {
  return { id, title: id, filePath: `/workspace/${id}`, content };
}

function createStore() {
  const state: NoteStoreState = {
    notes: [note(), note("background.md")],
    selectedNoteId: "note.md",
    editorContent: "disk content",
    openNoteIds: ["note.md"],
    playingNoteIds: [],
    savingNoteIds: new Set(),
    isLoadingFromFileSystem: false,
    searchKeyword: ""
  };
  const get = () => state as NoteStore;
  const set: NoteStoreSet = (update) => {
    if (typeof update === "function") update(get());
    else Object.assign(state, update);
  };
  const persistence = applyPersistence(set, get);
  const loaders = createLoaders(set, get);
  Object.assign(state, persistence, loaders);
  return { state, get, persistence, loaders };
}

describe("workspace scan loading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    workspaceState.workspacePath = "/workspace";
    getPinnedNotesMock.mockResolvedValue([]);
    writeMock.mockResolvedValue({ mtime: 1 });
    setLastSavedContent("note.md", "disk content");
    setLastSavedContent("background.md", "disk content");
  });

  afterEach(() => {
    clearAllDebouncedSaves();
    clearPendingSave("note.md");
    clearPendingSave("background.md");
    vi.useRealTimers();
  });

  it("keeps a debounced edit when editor and note content were updated together", async () => {
    const { state, get, persistence, loaders } = createStore();
    persistence.updateNoteContent("unsaved draft");

    await loaders.loadFromFileSystem({ notes: [note()] }, "/workspace");

    expect(state.editorContent).toBe("unsaved draft");
    expect(state.notes[0].content).toBe("unsaved draft");
    expect(getLastSavedContent("note.md")).toBe("disk content");

    persistence.updateNoteContent(`${state.editorContent} continued`);
    await flushAllDebouncedSaves(get);
    expect(writeMock).toHaveBeenLastCalledWith("/workspace/note.md", "unsaved draft continued");
  });

  it("also keeps pending edits to an unselected note", async () => {
    const { state, persistence, loaders } = createStore();
    persistence.updateNoteContentById("background.md", "background draft");

    await loaders.loadFromFileSystem({ notes: [note(), note("background.md")] }, "/workspace");

    expect(state.notes.find((item) => item.id === "background.md")?.content).toBe("background draft");
    expect(getLastSavedContent("background.md")).toBe("disk content");
  });

  it("accepts external disk changes when there is no local edit", async () => {
    const { state, loaders } = createStore();

    await loaders.loadFromFileSystem({ notes: [note("note.md", "external change")] }, "/workspace");

    expect(state.editorContent).toBe("external change");
    expect(getLastSavedContent("note.md")).toBe("external change");
  });

  it("keeps edits made while pin settings are being fetched", async () => {
    let finishSettings!: (pins: string[]) => void;
    getPinnedNotesMock.mockReturnValue(new Promise<string[]>((resolve) => (finishSettings = resolve)));
    const { state, persistence, loaders } = createStore();
    const loading = loaders.loadFromFileSystem({ notes: [note()] }, "/workspace");

    persistence.updateNoteContent("typed during loading");
    finishSettings([]);
    await loading;

    expect(state.editorContent).toBe("typed during loading");
    expect(getLastSavedContent("note.md")).toBe("disk content");
  });

  it("keeps the local draft if it finishes saving while pin settings are being fetched", async () => {
    let finishSettings!: (pins: string[]) => void;
    getPinnedNotesMock.mockReturnValue(new Promise<string[]>((resolve) => (finishSettings = resolve)));
    const { state, get, persistence, loaders } = createStore();
    persistence.updateNoteContent("draft saved during loading");
    const loading = loaders.loadFromFileSystem({ notes: [note()] }, "/workspace");

    await flushAllDebouncedSaves(get);
    finishSettings([]);
    await loading;

    expect(state.editorContent).toBe("draft saved during loading");
    expect(state.notes[0].content).toBe("draft saved during loading");
    expect(getLastSavedContent("note.md")).toBe("draft saved during loading");
  });

  it("keeps edits that both begin and finish saving during pin settings lookup", async () => {
    let finishSettings!: (pins: string[]) => void;
    getPinnedNotesMock.mockReturnValue(new Promise<string[]>((resolve) => (finishSettings = resolve)));
    const { state, get, persistence, loaders } = createStore();
    const loading = loaders.loadFromFileSystem({ notes: [note()] }, "/workspace");

    persistence.updateNoteContent("typed and saved during loading");
    await flushAllDebouncedSaves(get);
    finishSettings([]);
    await loading;

    expect(state.editorContent).toBe("typed and saved during loading");
    expect(state.notes[0].content).toBe("typed and saved during loading");
    expect(getLastSavedContent("note.md")).toBe("typed and saved during loading");
  });

  it("does not change save baselines if the workspace changes while loading", async () => {
    let finishSettings!: (pins: string[]) => void;
    getPinnedNotesMock.mockReturnValue(new Promise<string[]>((resolve) => (finishSettings = resolve)));
    const { state, loaders } = createStore();
    const loading = loaders.loadFromFileSystem({ notes: [note("note.md", "stale scan")] }, "/workspace");

    workspaceState.workspacePath = "/other";
    state.notes = [{ ...note(), filePath: "/other/note.md", content: "other workspace" }];
    state.editorContent = "other workspace";
    setLastSavedContent("note.md", "other workspace");
    finishSettings([]);
    await loading;

    expect(state.editorContent).toBe("other workspace");
    expect(getLastSavedContent("note.md")).toBe("other workspace");
  });
});
