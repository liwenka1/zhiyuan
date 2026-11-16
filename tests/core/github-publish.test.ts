import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";

const { noteState, workspaceState, githubState, pushMock, updateContentMock } = vi.hoisted(() => {
  const updateContentMock = vi.fn();
  return {
    noteState: {
      notes: [] as Note[],
      updateNoteContentById: updateContentMock,
      deleteNote: vi.fn(),
      duplicateNote: vi.fn(),
      togglePinNote: vi.fn()
    },
    workspaceState: { workspacePath: "/workspace" },
    githubState: { owner: "owner", repo: "repo", activeProjectKey: "project", isLoaded: true, load: vi.fn() },
    pushMock: vi.fn(),
    updateContentMock
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
  });

  it("does not apply returned metadata after the note was renamed or moved", async () => {
    const finishPush = holdPush();
    const publishing = createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    noteState.notes = [{ ...noteState.notes[0], id: "moved/note.md", filePath: "/workspace/moved/note.md" }];
    finishPush();
    await publishing;
    expect(updateContentMock).not.toHaveBeenCalled();
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
