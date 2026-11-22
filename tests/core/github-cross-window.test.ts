import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssuePushRequest, GitHubIssuePushResult, IpcResultDTO } from "@shared";
import { RENDERER_URL, trustedIpcEvent } from "./helpers/trusted-ipc-event";

const { handlers, createIssue, updateIssue, trash } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, ...args: unknown[]) => Promise<IpcResultDTO<unknown>>>(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  trash: vi.fn()
}));
vi.mock("electron", () => ({
  ipcMain: { handle: (name: string, callback: never) => handlers.set(name, callback) },
  shell: { trashItem: trash },
  BrowserWindow: { fromWebContents: () => ({ id: 1 }) },
  dialog: {},
  app: {}
}));
vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: {
    getGitHubActiveProjectKey: () => "project",
    getGitHubProjectConfigs: () => ({ project: { owner: "owner", repo: "repo", token: "selected-token" } })
  }
}));
vi.mock("../../apps/desktop/src/main/github", () => ({
  createIssue,
  updateIssue,
  getRepositoryDefaultBranch: vi.fn(),
  getContentSha: vi.fn(),
  uploadContent: vi.fn()
}));
vi.mock("../../apps/desktop/src/main/security/window-context", () => ({
  getCallerWorkspace: (event: { workspace: string }) => event.workspace
}));

vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: {
    getEntryByWebContents: (sender: { workspace: string }) => ({
      workspacePath: sender.workspace,
      rendererUrl: RENDERER_URL
    })
  }
}));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({ fileWatcherManager: {} }));
vi.mock("../../apps/desktop/src/main/ipc/watcher-handler", () => ({ registerWatcherHandlers: vi.fn() }));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { registerWorkspaceHandlers } from "../../apps/desktop/src/main/ipc/workspace-handler";
import { registerGitHubHandlers } from "../../apps/desktop/src/main/ipc/github-handler";

function sender(id: number, workspace: string) {
  let destroyed = false;
  const events = new EventEmitter();
  return Object.assign(events, {
    id,
    workspace,
    isDestroyed: () => destroyed,
    destroy() {
      destroyed = true;
      events.emit("destroyed");
    }
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => (resolve = complete));
  return { promise, resolve };
}

const association = { number: 12, html_url: "https://github.com/owner/repo/issues/12" };
const associatedContent =
  "<!-- github-issue-number: 12 -->\n<!-- github-issue-url: https://github.com/owner/repo/issues/12 -->\noriginal";

describe("main-process publication identity across windows", () => {
  let root: string;
  let nested: string;
  let sourcePath: string;
  let alias: string;
  let a: ReturnType<typeof trustedIpcEvent<ReturnType<typeof sender>>> & { workspace: string };
  let b: typeof a;
  let payload: GitHubIssuePushRequest;

  async function push(event: typeof a, overrides: Partial<GitHubIssuePushRequest> = {}) {
    return handlers.get("github:pushIssue")!(event, { ...payload, ...overrides }) as Promise<
      IpcResultDTO<GitHubIssuePushResult>
    >;
  }

  async function release(event: typeof a, result: IpcResultDTO<GitHubIssuePushResult>) {
    if (!result.ok) throw new Error(result.error.message);
    return handlers.get("github:releasePublication")!(event, result.value.publicationId);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    handlers.clear();
    root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-github-windows-")));
    nested = path.join(root, "nested");
    await fs.mkdir(nested);
    sourcePath = path.join(nested, "note.md");
    alias = path.join(root, "alias");
    await fs.symlink(nested, alias, process.platform === "win32" ? "junction" : "dir");
    await fs.writeFile(sourcePath, "original");
    a = { ...trustedIpcEvent(sender(1, root)), workspace: root };
    b = { ...trustedIpcEvent(sender(2, nested)), workspace: nested };
    payload = {
      projectKey: "project",
      owner: "owner",
      repo: "repo",
      token: "",
      title: "note",
      body: "original",
      sourcePath
    };
    createIssue.mockReset().mockResolvedValue(association);
    updateIssue.mockReset().mockResolvedValue({ html_url: association.html_url });
    trash.mockReset().mockImplementation((target: string) => fs.rm(target, { recursive: true }));
    registerGitHubHandlers();
    registerWorkspaceHandlers();
  });

  afterEach(async () => {
    a.sender.destroy();
    b.sender.destroy();
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("holds one lease through the remote create and local metadata commit for overlapping workspaces", async () => {
    const remote = deferred<typeof association>();
    createIssue.mockReturnValueOnce(remote.promise);
    const first = push(a);
    await vi.waitFor(() => expect(createIssue).toHaveBeenCalledOnce());
    expect(await push(b)).toMatchObject({ ok: false });
    remote.resolve(association);
    const result = await first;
    expect(result).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: true } });
    // Receiving the network response does not release the metadata commit lease.
    expect(await push(b)).toMatchObject({ ok: false });
    expect(createIssue).toHaveBeenCalledOnce();
    await fs.writeFile(sourcePath, associatedContent);
    expect(await release(a, result)).toMatchObject({ ok: true });
    // B still has no association in memory; main must read the source file.
    const retry = await push(b, { issueNumber: undefined });
    expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
    expect(updateIssue).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 12, token: "selected-token" }));
    expect(createIssue).toHaveBeenCalledOnce();
    await release(b, retry);
  });

  it("uses the same identity for a symlink alias and refuses release from another window", async () => {
    const first = await push(a, { sourcePath: path.join(alias, "note.md") });
    expect(first.ok).toBe(true);
    expect(await release(b, first)).toMatchObject({ ok: false });
    expect(await push(b)).toMatchObject({ ok: false });
    await fs.writeFile(sourcePath, associatedContent);
    await release(a, first);
    const retry = await push(b, { issueNumber: 99 });
    expect(updateIssue).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 12 }));
    expect(createIssue).toHaveBeenCalledOnce();
    await release(b, retry);
  });

  it("retries an uncommitted successful create as an update after local saving fails", async () => {
    const first = await push(a);
    await release(a, first); // Disk still has no metadata, as after a failed renderer save.
    const retry = await push(b);
    expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
    expect(createIssue).toHaveBeenCalledOnce();
    expect(updateIssue).toHaveBeenCalledOnce();
    await fs.writeFile(sourcePath, associatedContent);
    await release(b, retry);
  });

  it("keeps an abandoned in-flight create locked until completion and recovers its association", async () => {
    const remote = deferred<typeof association>();
    createIssue.mockReturnValueOnce(remote.promise);
    const first = push(a);
    await vi.waitFor(() => expect(createIssue).toHaveBeenCalledOnce());
    a.sender.destroy();
    expect(await push(b)).toMatchObject({ ok: false });
    remote.resolve(association);
    await first;
    const retry = await push(b);
    expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
    expect(createIssue).toHaveBeenCalledOnce();
    expect(a.sender.listenerCount("destroyed")).toBe(0);
    await fs.writeFile(sourcePath, associatedContent);
    await release(b, retry);
  });

  it("releases a failed remote request and allows a later create", async () => {
    createIssue.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await push(a)).toMatchObject({ ok: false });
    const retry = await push(b);
    expect(retry).toMatchObject({ ok: true, value: { isNew: true } });
    expect(createIssue).toHaveBeenCalledTimes(2);
    await fs.writeFile(sourcePath, associatedContent);
    await release(b, retry);
  });

  it.each(["file:rename", "folder:rename"] as const)(
    "blocks cross-window path changes through the metadata commit, then permits %s",
    async (channel) => {
      const remote = deferred<typeof association>();
      createIssue.mockReturnValueOnce(remote.promise);
      const first = push(b);
      await vi.waitFor(() => expect(createIssue).toHaveBeenCalledOnce());
      const renamedFile = path.join(nested, "renamed.md");
      const renamedFolder = path.join(root, "renamed");
      const attempts: Array<[string, string[]]> = [
        ["file:rename", [sourcePath, renamedFile]],
        ["file:delete", [sourcePath]],
        ["folder:rename", [nested, renamedFolder]],
        ["folder:delete", [nested]]
      ];
      for (const [name, args] of attempts) {
        expect(await handlers.get(name)!(a, ...args)).toMatchObject({
          ok: false,
          error: { message: expect.stringContaining("still being published") }
        });
      }
      remote.resolve(association);
      const result = await first;
      expect(await handlers.get("file:rename")!(a, sourcePath, renamedFile)).toMatchObject({ ok: false });
      await fs.writeFile(sourcePath, associatedContent);
      await release(b, result);
      const args = channel === "file:rename" ? [sourcePath, renamedFile] : [nested, renamedFolder];
      expect(await handlers.get(channel)!(a, ...args)).toMatchObject({ ok: true });
      const movedPath = channel === "file:rename" ? renamedFile : path.join(renamedFolder, "note.md");
      expect(await fs.readFile(movedPath, "utf8")).toBe(associatedContent);
      const retry = await push(a, { sourcePath: movedPath });
      expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
      expect(createIssue).toHaveBeenCalledOnce();
      await release(a, retry);
    }
  );

  it("rejects publishing while another window's asynchronous rename holds the source identity", async () => {
    const gate = deferred<void>();
    const started = deferred<void>();
    const rename = fileSystem.renameFile.bind(fileSystem);
    vi.spyOn(fileSystem, "renameFile").mockImplementationOnce(async (...args) => {
      started.resolve();
      await gate.promise;
      return rename(...args);
    });
    const destination = path.join(nested, "renamed.md");
    const moving = handlers.get("file:rename")!(a, sourcePath, destination);
    await started.promise;
    expect(await push(b)).toMatchObject({ ok: false });
    expect(createIssue).not.toHaveBeenCalled();
    gate.resolve();
    expect(await moving).toMatchObject({ ok: true });
    const result = await push(b, { sourcePath: destination });
    expect(result).toMatchObject({ ok: true, value: { isNew: true } });
    await fs.writeFile(destination, associatedContent);
    await release(b, result);
  });

  it.each(["file:rename", "folder:rename"] as const)(
    "moves an uncommitted remote association with a successful %s before retrying",
    async (channel) => {
      const first = await push(b);
      await release(b, first); // A successful create whose local metadata save failed.
      const destination = channel === "file:rename" ? path.join(nested, "renamed.md") : path.join(root, "renamed");
      const from = channel === "file:rename" ? sourcePath : nested;
      expect(await handlers.get(channel)!(a, from, destination)).toMatchObject({ ok: true });
      const movedPath = channel === "file:rename" ? destination : path.join(destination, "note.md");
      expect(await fs.readFile(movedPath, "utf8")).toBe("original");
      const retry = await push(a, { sourcePath: movedPath });
      expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
      expect(createIssue).toHaveBeenCalledOnce();
      await fs.writeFile(movedPath, associatedContent);
      await release(a, retry);
    }
  );

  it.for(["file:rename", "folder:rename", "file:delete", "folder:delete"] as const)(
    "blocks %s through differently cased source spellings on a case-insensitive filesystem",
    async (channel, { skip }) => {
      const alternate = channel.startsWith("file:") ? path.join(nested, "Note.md") : path.join(root, "Nested");
      if (!(await fs.stat(alternate).catch(() => null))) return skip();
      const remote = deferred<typeof association>();
      createIssue.mockReturnValueOnce(remote.promise);
      const first = push(b);
      try {
        await vi.waitFor(() => expect(createIssue).toHaveBeenCalledOnce());
        const destination = channel === "file:rename" ? path.join(nested, "renamed.md") : path.join(root, "renamed");
        const args = channel.endsWith(":rename") ? [alternate, destination] : [alternate];
        expect(await handlers.get(channel)!(a, ...args)).toMatchObject({
          ok: false,
          error: { message: expect.stringContaining("still being published") }
        });
        expect(createIssue).toHaveBeenCalledOnce();
      } finally {
        remote.resolve(association);
        await release(b, await first);
      }
    }
  );

  it.each(["file:rename", "folder:rename"] as const)(
    "retains an uncommitted association after a case-only %s using the resulting disk spelling",
    async (channel) => {
      const first = await push(b);
      await release(b, first);
      const destination = channel === "file:rename" ? path.join(nested, "Note.md") : path.join(root, "Nested");
      const from = channel === "file:rename" ? sourcePath : nested;
      expect(await handlers.get(channel)!(a, from, destination)).toMatchObject({ ok: true });
      const movedPath = channel === "file:rename" ? destination : path.join(destination, "note.md");
      const actualPath = await fs.realpath(movedPath);
      expect(actualPath).toBe(movedPath);
      expect(await fs.readFile(actualPath, "utf8")).toBe("original");
      const retry = await push(a, { sourcePath: actualPath });
      expect(retry).toMatchObject({ ok: true, value: { issueNumber: 12, isNew: false } });
      expect(createIssue).toHaveBeenCalledOnce();
      expect(updateIssue).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ issueNumber: 12 }));
      await fs.writeFile(actualPath, associatedContent);
      await release(a, retry);
    }
  );

  it.each(["file:delete", "folder:delete"] as const)(
    "forgets an uncommitted association after %s so a replacement note cannot inherit it",
    async (channel) => {
      const first = await push(b);
      await release(b, first);
      const target = channel === "file:delete" ? sourcePath : nested;
      expect(await handlers.get(channel)!(a, target)).toMatchObject({ ok: true });
      expect(trash).toHaveBeenCalledExactlyOnceWith(target);
      await fs.mkdir(nested, { recursive: true });
      await fs.writeFile(sourcePath, "new unrelated note");
      const replacement = await push(b, { body: "new unrelated note" });
      expect(replacement).toMatchObject({ ok: true, value: { isNew: true } });
      expect(createIssue).toHaveBeenCalledTimes(2);
      expect(updateIssue).not.toHaveBeenCalled();
      await fs.writeFile(sourcePath, associatedContent);
      await release(b, replacement);
    }
  );

  it("rejects a source outside the caller workspace before any GitHub request", async () => {
    b.workspace = path.join(root, "unrelated");
    expect(await push(b)).toMatchObject({ ok: false });
    expect(createIssue).not.toHaveBeenCalled();
    expect(updateIssue).not.toHaveBeenCalled();
  });
});
