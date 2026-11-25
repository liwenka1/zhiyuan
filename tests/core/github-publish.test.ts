import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "../../apps/desktop/src/renderer/src/types";

const { noteState, workspaceState, githubState, pushMock, uploadMock, releaseMock, updateContentMock, saveMock } =
  vi.hoisted(() => {
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
      uploadMock: vi.fn(),
      releaseMock: vi.fn(),
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
vi.mock("@/ipc", () => ({
  githubIpc: { pushIssue: pushMock, uploadAsset: uploadMock, releasePublication: releaseMock },
  shellIpc: {},
  fileIpc: {},
  configIpc: {}
}));
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
  let resolve!: (value: { issueNumber: number; issueUrl: string; isNew: boolean; publicationId: string }) => void;
  pushMock.mockReturnValueOnce(new Promise((complete) => (resolve = complete)));
  return () =>
    resolve({
      issueNumber: 12,
      issueUrl: "https://github.com/owner/repo/issues/12",
      isNew: true,
      publicationId: "publication-12"
    });
}

describe("GitHub publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockReset();
    pushMock.mockReset();
    pushMock.mockResolvedValue({
      issueNumber: 12,
      issueUrl: "https://github.com/owner/repo/issues/12",
      isNew: true,
      publicationId: "publication-12"
    });
    noteState.notes = [
      { id: "note.md", fileName: "note.md", filePath: "/workspace/note.md", title: "note", content: "original" }
    ];
    workspaceState.workspacePath = "/workspace";
    githubState.owner = "owner";
    githubState.repo = "repo";
    githubState.isLoaded = true;
    githubState.load.mockReset();
    saveMock.mockReset().mockResolvedValue(undefined);
    releaseMock.mockReset().mockResolvedValue(undefined);
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

  it("uploads UNC attachments from the selected workspace and changes only those link destinations", async () => {
    const image = "//server/share/My Notes/figure (1).png";
    const encoded = "//server/share/My%20Notes/figure%20(1).png";
    const web = "//server/share/My%20Notes-other/figure.png";
    const publicImage = `https:${encoded}`;
    const rawUrl = "https://raw.githubusercontent.com/owner/repo/main/assets/figure.png";
    const example = `\`\`\`md\n![Example](${image})\n\`\`\``;
    workspaceState.workspacePath = "\\\\server\\share\\My Notes";
    noteState.notes = [
      {
        ...noteState.notes[0],
        filePath: "\\\\server\\share\\My Notes\\note.md",
        content: `[![Figure\ncaption](${image})](https://example.com)\n\n![Encoded\ncaption](${encoded})\n\n![Wrapped](\n  ${encoded}\n  "Title\ncaption"\n)\n\n![Quoted]("${image}")\n\n[Web](${web})\n\n[Public](${publicImage})\n\n${example}`
      }
    ];
    uploadMock.mockResolvedValueOnce({ rawUrl });

    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });

    expect(uploadMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ localPath: image }));
    expect(pushMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        body: `[![Figure\ncaption](${rawUrl})](https://example.com)\n\n![Encoded\ncaption](${rawUrl})\n\n![Wrapped](\n  ${rawUrl}\n  "Title\ncaption"\n)\n\n![Quoted](${rawUrl})\n\n[Web](${web})\n\n[Public](${publicImage})\n\n${example}`
      })
    );
  });

  it("publishes both the image and click destinations of a linked local image", async () => {
    const rawUrl = "https://raw.githubusercontent.com/owner/repo/main/assets/chart.png";
    noteState.notes[0].content = '[![Preview](./chart.png)](./chart.png "Open full size")';
    uploadMock.mockResolvedValueOnce({ rawUrl });

    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });

    expect(uploadMock).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ localPath: "/workspace/chart.png" }));
    expect(pushMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ body: `[![Preview](${rawUrl})](${rawUrl} "Open full size")` })
    );
  });

  it("uploads quoted local destinations with spaces after literal filename delimiters", async () => {
    const filename = "figure#version two.png";
    const rawUrl = "https://raw.githubusercontent.com/owner/repo/main/assets/figure%23version%20two.png";
    const webLink = '[Documentation]("https://example.com/guide")';
    noteState.notes[0].content = [
      `![Figure]("/workspace/${filename}")`,
      `[Download]('./${filename}' "Open full size")`,
      '[Legacy]("local-resource:///workspace/figure%23version two.png")',
      webLink
    ].join("\n\n");
    uploadMock.mockResolvedValueOnce({ rawUrl });

    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });

    expect(uploadMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ localPath: `/workspace/${filename}` })
    );
    expect(pushMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        body: `![Figure](${rawUrl})\n\n[Download](${rawUrl} "Open full size")\n\n[Legacy](${rawUrl})\n\n${webLink}`
      })
    );
  });

  it("keeps a linked image parseable when its uploaded paths contain unmatched parentheses", async () => {
    const prefix = "https://raw.githubusercontent.com/owner/repo/main/assets/draft(1).md)/";
    const encoded = "https://raw.githubusercontent.com/owner/repo/main/assets/draft%281%29.md%29/";
    noteState.notes[0].content = '[![Preview](./chart `draft`.png)](/workspace/chart (full).png "Open full size")';
    uploadMock
      .mockResolvedValueOnce({ rawUrl: `${prefix}preview.png` })
      .mockResolvedValueOnce({ rawUrl: `${prefix}full.png` });

    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });

    expect(uploadMock).toHaveBeenCalledTimes(2);
    expect(uploadMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ localPath: "/workspace/chart `draft`.png" })
    );
    expect(uploadMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ localPath: "/workspace/chart (full).png" })
    );
    expect(pushMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ body: `[![Preview](${encoded}preview.png)](${encoded}full.png "Open full size")` })
    );
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
    expect(releaseMock).not.toHaveBeenCalled();
    finishWriting();
    await publishing;
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith("publication-12");
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

  it("releases the main-process lease when the local metadata commit fails", async () => {
    saveMock.mockRejectedValueOnce(new Error("disk changed"));
    await createHandlers().handlePushToGitHub({ id: "note.md", title: "note" });
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ sourcePath: "/workspace/note.md" }));
    expect(releaseMock).toHaveBeenCalledExactlyOnceWith("publication-12");
    expect(isPublishingPath("/workspace", "/workspace/note.md")).toBe(false);
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
