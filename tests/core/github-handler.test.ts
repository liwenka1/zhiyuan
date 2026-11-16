import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubAssetUploadRequest, GitHubConfig, GitHubIssuePushRequest, IpcResultDTO } from "@shared";

const { handlers, projectState, updateMock, createMock, branchMock, uploadMock } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, payload: unknown) => Promise<IpcResultDTO<unknown>>>(),
  projectState: { projects: {} as Record<string, GitHubConfig>, active: "selected" },
  updateMock: vi.fn(),
  createMock: vi.fn(),
  branchMock: vi.fn(),
  uploadMock: vi.fn()
}));
vi.mock("electron", () => ({ ipcMain: { handle: (name: string, callback: never) => handlers.set(name, callback) } }));
vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: {
    getGitHubActiveProjectKey: () => projectState.active,
    getGitHubProjectConfigs: () => projectState.projects
  }
}));
vi.mock("../../apps/desktop/src/main/github", () => ({
  createIssue: createMock,
  updateIssue: updateMock,
  getRepositoryDefaultBranch: branchMock,
  getContentSha: vi.fn(),
  uploadContent: uploadMock
}));
vi.mock("../../apps/desktop/src/main/security/window-context", () => ({ getCallerWorkspace: () => "/workspace" }));

import { registerGitHubHandlers } from "../../apps/desktop/src/main/ipc/github-handler";

const push: GitHubIssuePushRequest = {
  projectKey: "selected",
  owner: "owner",
  repo: "old-repo",
  token: "",
  title: "note",
  body: "body",
  issueNumber: 3
};
const upload: GitHubAssetUploadRequest = {
  projectKey: "selected",
  owner: "owner",
  repo: "old-repo",
  token: "",
  noteId: "note.md",
  localPath: "/workspace/a.png"
};

describe("GitHub project request snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    projectState.projects = {
      other: { owner: "owner", repo: "old-repo", token: "wrong-project-token" },
      selected: { owner: "owner", repo: "old-repo", token: "selected-token" }
    };
    projectState.active = "other";
    updateMock.mockResolvedValue({ html_url: "https://github.com/owner/old-repo/issues/3" });
    createMock.mockResolvedValue({ number: 4, html_url: "https://github.com/owner/old-repo/issues/4" });
    registerGitHubHandlers();
  });

  it("rejects an old window's issue update after another window changes its project repository", async () => {
    projectState.projects.selected = { owner: "owner", repo: "new-repo", token: "new-token" };
    expect(await handlers.get("github:pushIssue")!({}, push)).toMatchObject({ ok: false });
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an old window's asset upload before making any repository request", async () => {
    projectState.projects.selected = { owner: "owner", repo: "new-repo", token: "new-token" };
    expect(await handlers.get("github:uploadAsset")!({}, upload)).toMatchObject({ ok: false });
    expect(branchMock).not.toHaveBeenCalled();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("keeps the selected project's credentials while matching repository names case-insensitively", async () => {
    expect(await handlers.get("github:pushIssue")!({}, { ...push, owner: "OWNER", repo: "OLD-REPO" })).toMatchObject({
      ok: true
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "owner", repo: "old-repo", token: "selected-token", issueNumber: 3 })
    );
  });

  it("rejects a deleted project instead of falling back to credentials supplied by a stale window", async () => {
    delete projectState.projects.selected;
    expect(await handlers.get("github:pushIssue")!({}, { ...push, token: "old-token" })).toMatchObject({ ok: false });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
