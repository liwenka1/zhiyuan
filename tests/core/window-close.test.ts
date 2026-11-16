import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { saveMock, flushMock, readyMock, onPrepareCloseMock, unsubscribeMock, errorMock, noteState } = vi.hoisted(
  () => ({
    saveMock: vi.fn(),
    flushMock: vi.fn(),
    readyMock: vi.fn(),
    onPrepareCloseMock: vi.fn(),
    unsubscribeMock: vi.fn(),
    errorMock: vi.fn(),
    noteState: { selectedNoteId: null as string | null, editorContent: "" }
  })
);

let cleanup: (() => void) | undefined;
vi.mock("react", () => ({
  useEffect: (effect: () => () => void) => {
    cleanup = effect();
  }
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { error: errorMock } }));
vi.mock("@/stores/note-store", () => ({
  useNoteStore: { getState: () => ({ ...noteState, saveNoteToFileSystem: saveMock }) }
}));
vi.mock("@/stores/note-store/persistence", () => ({ flushAllDebouncedSaves: flushMock }));

import { useWindowClose } from "../../apps/desktop/src/renderer/src/hooks/use-window-close";

describe("application close handshake", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    noteState.selectedNoteId = null;
    noteState.editorContent = "";
    saveMock.mockResolvedValue(undefined);
    flushMock.mockResolvedValue(undefined);
    readyMock.mockResolvedValue({ ok: true });
    onPrepareCloseMock.mockReturnValue(unsubscribeMock);
    vi.stubGlobal("window", {
      api: { window: { readyToClose: readyMock, onPrepareClose: onPrepareCloseMock } }
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllGlobals();
  });

  it("acknowledges closing on the welcome page without requiring a selected note", async () => {
    useWindowClose();
    const callback = onPrepareCloseMock.mock.calls[0][0];
    callback(7);
    await vi.waitFor(() => expect(readyMock).toHaveBeenCalledWith(7));
    expect(saveMock).not.toHaveBeenCalled();
    expect(flushMock).toHaveBeenCalledOnce();
  });

  it("waits for selected-note and pending saves before acknowledging the current token", async () => {
    noteState.selectedNoteId = "draft.md";
    noteState.editorContent = "unsaved draft";
    let finishFlush!: () => void;
    flushMock.mockReturnValueOnce(new Promise<void>((resolve) => (finishFlush = resolve)));
    useWindowClose();
    onPrepareCloseMock.mock.calls[0][0](8);
    await vi.waitFor(() => expect(flushMock).toHaveBeenCalledOnce());
    expect(saveMock).toHaveBeenCalledWith("draft.md", "unsaved draft");
    expect(readyMock).not.toHaveBeenCalled();
    finishFlush();
    await vi.waitFor(() => expect(readyMock).toHaveBeenCalledWith(8));
  });

  it("keeps the window open when a save fails", async () => {
    noteState.selectedNoteId = "draft.md";
    saveMock.mockRejectedValueOnce(new Error("disk full"));
    useWindowClose();
    onPrepareCloseMock.mock.calls[0][0](9);
    await vi.waitFor(() => expect(errorMock).toHaveBeenCalled());
    expect(readyMock).not.toHaveBeenCalled();
    expect(flushMock).not.toHaveBeenCalled();
  });

  it("removes the global listener on unmount", () => {
    useWindowClose();
    cleanup?.();
    cleanup = undefined;
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });
});
