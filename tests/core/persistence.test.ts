import { beforeEach, describe, expect, it, vi } from "vitest";

const { writeMock, toastErrorMock } = vi.hoisted(() => ({
  writeMock: vi.fn(),
  toastErrorMock: vi.fn()
}));

vi.mock("@/ipc", () => ({
  fileIpc: {
    write: writeMock
  }
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock
  }
}));

vi.mock("@/lib/i18n", () => ({
  default: {
    t: (key: string) => key
  }
}));

vi.mock("@/lib/github-metadata", () => ({
  parseGitHubMetadata: vi.fn(() => undefined)
}));

import {
  applyPersistence,
  flushAllDebouncedSaves
} from "../../apps/desktop/src/renderer/src/stores/note-store/persistence";

interface TestNote {
  id: string;
  filePath: string;
  content: string;
  isPinned: boolean;
}

type TestState = {
  notes: TestNote[];
  selectedNoteId: string | null;
  editorContent: string;
  savingNoteIds: Set<string>;
  [key: string]: unknown;
};

type TestStore = {
  state: TestState;
  get: () => TestState;
  actions: ReturnType<typeof applyPersistence>;
};

function createTestStore(note: TestNote): TestStore {
  const state: TestState = {
    notes: [note],
    selectedNoteId: note.id,
    editorContent: note.content,
    savingNoteIds: new Set()
  };

  const set = (update: ((state: TestState) => void) | Partial<TestState>) => {
    if (typeof update === "function") update(state);
    else Object.assign(state, update);
  };
  const get = () => state;
  const actions = applyPersistence(set as never, get as never);
  Object.assign(state, actions);
  return { state, get, actions };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("note persistence queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes writes and persists the latest content queued during a save", async () => {
    const firstWrite = deferred<{ mtime: number }>();
    const writes: string[] = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;

    writeMock.mockImplementation(async (_filePath: string, content: string) => {
      writes.push(content);
      activeWrites += 1;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      if (writes.length === 1) {
        const result = await firstWrite.promise;
        activeWrites -= 1;
        return result;
      }
      activeWrites -= 1;
      return { mtime: Date.now() };
    });

    const { actions } = createTestStore({
      id: "note.md",
      filePath: "/workspace/note.md",
      content: "old",
      isPinned: false
    });
    const first = actions.saveNoteToFileSystem("note.md", "first");
    await vi.waitFor(() => expect(writes).toEqual(["first"]));

    const second = actions.saveNoteToFileSystem("note.md", "second");
    firstWrite.resolve({ mtime: Date.now() });
    await Promise.all([first, second]);

    expect(writes).toEqual(["first", "second"]);
    expect(maxActiveWrites).toBe(1);
  });

  it("keeps a failed pending save retryable", async () => {
    writeMock.mockRejectedValueOnce(new Error("disk full")).mockResolvedValue({ mtime: Date.now() });

    const { actions } = createTestStore({
      id: "note.md",
      filePath: "/workspace/note.md",
      content: "old",
      isPinned: false
    });
    await expect(actions.saveNoteToFileSystem("note.md", "draft")).rejects.toThrow("disk full");
    await expect(actions.saveNoteToFileSystem("note.md", "draft")).resolves.toBeUndefined();

    expect(writeMock).toHaveBeenCalledTimes(2);
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("flushes debounced edits before the timer fires", async () => {
    writeMock.mockResolvedValue({ mtime: Date.now() });
    const { state, get, actions } = createTestStore({
      id: "note.md",
      filePath: "/workspace/note.md",
      content: "old",
      isPinned: false
    });

    actions.updateNoteContent("draft");
    await flushAllDebouncedSaves(get as never);

    expect(state.editorContent).toBe("draft");
    expect(writeMock).toHaveBeenCalledWith("/workspace/note.md", "draft");
  });
});
