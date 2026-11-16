import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";

const { noteState, workspaceState, githubState, pushMock, updateContentMock, saveMock } = vi.hoisted(() => {
  const updateContentMock = vi.fn();
  const saveMock = vi.fn();
  return {
    noteState: {
      notes: [] as Note[],
      updateNoteContentById: updateContentMock,
      saveNoteToFileSystem: saveMock,
      deleteNote: vi.fn(),
      duplicateNote: vi.fn(),
      togglePinNote: vi.fn()
    },
    workspaceState: { workspacePath: "/workspace" },
    githubState: { owner: "owner", repo: "repo", activeProjectKey: "project", isLoaded: true, load: vi.fn() },
    pushMock: vi.fn(),
    updateContentMock,
    saveMock
  };
});

vi.mock("@/stores", () => ({
  useNoteStore: Object.assign((selector: (state: typeof noteState) => unknown) => selector(noteState), {
    getState: () => noteState
  }),
  useWorkspaceStore: Object.assign((selector: (state: typeof workspaceState) => unknown) => selector(workspaceState), {
    getState: () => workspaceState
  }),
  useGitHubSettingsStore: { getState: () => githubState }
}));
vi.mock("@/features/export", () => ({ useNoteExport: () => ({ exportNote: vi.fn(), copyToWechat: vi.fn() }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/ipc", () => ({ githubIpc: { pushIssue: pushMock }, shellIpc: {}, fileIpc: {}, configIpc: {} }));
vi.mock("@/lib/markdown-assets", () => ({ collectLocalMarkdownAssets: () => [], replaceMarkdownAssetUrls: vi.fn() }));
vi.mock("@/lib/github-assets", () => ({ uploadMarkdownAssets: vi.fn() }));
vi.mock("@/stores/note-store/persistence", () => ({ clearDebouncedSave: vi.fn(), clearPendingSave: vi.fn() }));

import { useNoteHandlers } from "../../apps/desktop/src/renderer/src/features/note-workspace/hooks/use-note-handlers";
import {
  beginCloseRequest,
  beginFileOperation,
  beginPublishing,
  isPublishingPath,
  waitForBackgroundSaves
} from "../../apps/desktop/src/renderer/src/stores/note-store/operation-guard";

function createHandlers() {
  return useNoteHandlers({ onOpenRenameDialog: vi.fn(), onOpenCreateNoteDialog: vi.fn() });
}

function holdPush() {
  let resolve!: (value: { issueNumber: number; issueUrl: string; isNew: boolean }) => void;
  pushMock.mockReturnValueOnce(new Promise((complete) => (resolve = complete)));
  return () => resolve({ issueNumber: 12, issueUrl: "https://github.com/owner/repo/issues/12", isNew: true });
}

describe("GitHub publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushMock.mockReset();
    pushMock.mockResolvedValue({ issueNumber: 12, issueUrl: "https://github.com/owner/repo/issues/12", isNew: true });
    noteState.notes = [
      { id: "note.md", fileName: "note.md", filePath: "/workspace/note.md", title: "note", content: "original" }
    ];
    workspaceState.workspacePath = "/workspace";
    githubState.owner = "owner";
    githubState.repo = "repo";
    githubState.isLoaded = true;
    githubState.load.mockReset();
    saveMock.mockReset().mockResolvedValue(undefined);
  });

  it("applies returned metadata to the latest local content after an in-flight edit", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    noteState.notes = [{ ...noteState.notes[0], content: "typed while publishing" }];
    finishPush();
    await publishing;

    expect(updateContentMock).toHaveBeenCalledWith("note.md", expect.stringContaining("typed while publishing"));
    expect(updateContentMock.mock.calls[0][1]).toContain("github-issue-number: 12");
  });

  it("does not apply a late result to the same note ID in another workspace", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    workspaceState.workspacePath = "/other";
    noteState.notes = [{ ...noteState.notes[0], filePath: "/other/note.md", content: "other note" }];
    finishPush();
    await publishing;
    expect(updateContentMock).not.toHaveBeenCalled();
  });

  it("waits for another note's file operation before applying successful publication metadata", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const release = beginFileOperation();
    expect(release).not.toBeNull();
    try {
      finishPush();
      for (let index = 0; index < 5; index++) await Promise.resolve();
      expect(updateContentMock).not.toHaveBeenCalled();
    } finally {
      release?.();
    }
    await publishing;
    expect(updateContentMock).toHaveBeenCalledWith("note.md", expect.stringContaining("github-issue-number: 12"));
  });

  it("tracks publication through the metadata commit so closing can wait for it", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    let backgroundFinished = false;
    const waiting = waitForBackgroundSaves().then(() => {
      backgroundFinished = true;
    });
    for (let index = 0; index < 5; index++) await Promise.resolve();
    expect(backgroundFinished).toBe(false);
    finishPush();
    await publishing;
    await waiting;
    expect(updateContentMock).toHaveBeenCalled();
    expect(backgroundFinished).toBe(true);
  });

  it("does not start another publication after a close request locks editing", async () => {
    const release = beginCloseRequest();
    try {
      await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
      await waitForBackgroundSaves();
      expect(pushMock).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it("releases background tracking even when loading project settings fails", async () => {
    githubState.isLoaded = false;
    githubState.load.mockRejectedValueOnce(new Error("settings unavailable"));
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    await waitForBackgroundSaves();
    expect(pushMock).not.toHaveBeenCalled();
    expect(isPublishingPath("/workspace", "/workspace/note.md")).toBe(false);
  });

  it("blocks the source file and its parent directory until publication metadata is saved", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    const finishWriting = (() => {
      let finish!: () => void;
      saveMock.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
      return () => finish();
    })();
    expect(beginFileOperation({ workspacePath: "/workspace", path: "/workspace/note.md" })).toBeNull();
    expect(
      beginFileOperation({ workspacePath: "/workspace", path: "/workspace", includeDescendants: true })
    ).toBeNull();
    finishPush();
    for (let index = 0; index < 5; index++) await Promise.resolve();
    expect(saveMock).toHaveBeenCalledWith(
      "note.md",
      expect.stringContaining("github-issue-number: 12"),
      "/workspace/note.md"
    );
    expect(isPublishingPath("/workspace", "/workspace/note.md")).toBe(true);
    finishWriting();
    await publishing;
    expect(isPublishingPath("/workspace", "/workspace/note.md")).toBe(false);
  });

  it("does not issue a second create while the same note is being published", async () => {
    const finishPush = holdPush();
    const first = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(pushMock).toHaveBeenCalledTimes(1);
    finishPush();
    await first;
  });

  it("releases the publication lease after a remote failure so retry is possible", async () => {
    pushMock.mockRejectedValueOnce(new Error("network unavailable"));
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(isPublishingPath("/workspace", "/workspace/note.md")).toBe(false);
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(pushMock).toHaveBeenCalledTimes(2);
  });

  it("allows a different note to publish and perform file operations independently", async () => {
    noteState.notes.push({
      id: "other.md",
      fileName: "other.md",
      filePath: "/workspace/other.md",
      title: "other",
      content: "other"
    });
    const finishPush = holdPush();
    const first = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    await createHandlers().handlePushToGitHub({ id: "other.md", title: "other" });
    expect(pushMock).toHaveBeenCalledTimes(2);
    const release = beginFileOperation({ workspacePath: "/workspace", path: "/workspace/other.md" });
    expect(release).not.toBeNull();
    release?.();
    finishPush();
    await first;
  });

  it("normalizes Windows path spelling and keeps directory boundaries distinct", () => {
    const release = beginPublishing("C:\\", "C:\\notes\\note.md");
    expect(release).not.toBeNull();
    try {
      expect(isPublishingPath("c:/", "c:/NOTES", true)).toBe(true);
      expect(isPublishingPath("c:/", "c:/note", true)).toBe(false);
      expect(isPublishingPath("D:/", "c:/notes/note.md")).toBe(false);
    } finally {
      release?.();
    }
  });

  it("creates an issue instead of updating the same number in a different repository", async () => {
    noteState.notes[0].github = { issueNumber: 3, issueUrl: "https://github.com/owner/old-repo/issues/3" };
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ repo: "repo", issueNumber: undefined }));
  });

  it("updates the previous issue when its URL belongs to the selected repository", async () => {
    noteState.notes[0].github = { issueNumber: 3, issueUrl: "https://github.com/OWNER/REPO/issues/3" };
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 3 }));
  });
});
