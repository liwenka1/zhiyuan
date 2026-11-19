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

import { captureNoteLoadSnapshot, createLoaders } from "../../apps/desktop/src/renderer/src/stores/note-store/loaders";
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
    isLoadingFromFileSystem: false
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
    expect(writeMock).toHaveBeenLastCalledWith("/workspace/note.md", "unsaved draft continued", "disk content");
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

  it("preserves edits saved while the workspace scan itself is still running", async () => {
    const { state, get, persistence, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);
    let finishScan!: (data: { notes: Note[] }) => void;
    const scan = new Promise<{ notes: Note[] }>((resolve) => (finishScan = resolve));

    persistence.updateNoteContent("saved during slow scan");
    await flushAllDebouncedSaves(get);
    finishScan({ notes: [note()] });
    await loaders.loadFromFileSystem(await scan, "/workspace", beforeScan);

    expect(state.editorContent).toBe("saved during slow scan");
    expect(getLastSavedContent("note.md")).toBe("saved during slow scan");
  });

  it("keeps a dirty draft even if its file disappears from the scan", async () => {
    const { state, get, persistence, loaders } = createStore();
    persistence.updateNoteContent("draft whose file was deleted externally");
    const beforeScan = captureNoteLoadSnapshot(get);

    await loaders.loadFromFileSystem({ notes: [] }, "/workspace", beforeScan);

    expect(state.selectedNoteId).toBe("note.md");
    expect(state.editorContent).toBe("draft whose file was deleted externally");
    expect(state.notes).toMatchObject([{ id: "note.md", content: "draft whose file was deleted externally" }]);
  });

  it("keeps notes created while a scan was already in progress", async () => {
    const { state, get, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);
    state.notes.push(note("new.md", "created after scanning started"));
    setLastSavedContent("new.md", "created after scanning started");
    state.selectedNoteId = "new.md";
    state.editorContent = "created after scanning started";

    await loaders.loadFromFileSystem({ notes: [note()] }, "/workspace", beforeScan);

    expect(state.selectedNoteId).toBe("new.md");
    expect(state.editorContent).toBe("created after scanning started");
    expect(state.notes.find((item) => item.id === "new.md")?.content).toBe("created after scanning started");
  });

  it("still removes clean notes that are absent from the scan", async () => {
    const { state, get, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);

    await loaders.loadFromFileSystem({ notes: [] }, "/workspace", beforeScan);

    expect(state.notes).toEqual([]);
    expect(state.selectedNoteId).toBeNull();
  });

  it("keeps a new note's latest saved content even if the scan contains an earlier version", async () => {
    const { state, get, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);
    state.notes.push(note("new.md", "latest saved content"));
    setLastSavedContent("new.md", "latest saved content");

    await loaders.loadFromFileSystem({ notes: [note("new.md", "early scan content")] }, "/workspace", beforeScan);

    expect(state.notes.find((item) => item.id === "new.md")?.content).toBe("latest saved content");
  });

  it("keeps newly saved content for a note omitted by an older scan", async () => {
    const { state, get, persistence, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);
    persistence.updateNoteContent("saved after scan began");
    await flushAllDebouncedSaves(get);

    await loaders.loadFromFileSystem({ notes: [] }, "/workspace", beforeScan);

    expect(state.editorContent).toBe("saved after scan began");
    expect(state.notes.find((item) => item.id === "note.md")?.content).toBe("saved after scan began");
  });

  it("does not resurrect the previous filename if a note was renamed during scanning", async () => {
    const { state, get, loaders } = createStore();
    const beforeScan = captureNoteLoadSnapshot(get);
    state.notes = [note("renamed.md")];
    state.selectedNoteId = "renamed.md";
    setLastSavedContent("renamed.md", "disk content");

    await loaders.loadFromFileSystem({ notes: [note()] }, "/workspace", beforeScan);

    expect(state.notes.map((item) => item.id)).toEqual(["renamed.md"]);
    expect(state.selectedNoteId).toBe("renamed.md");
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
