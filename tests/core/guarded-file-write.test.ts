import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type WriteHandler = (
  event: Electron.IpcMainInvokeEvent,
  filePath: string,
  content: string,
  expectedContent?: string
) => Promise<IpcResultDTO<{ mtime: number }>>;

const { handlers, caller } = vi.hoisted(() => ({
  handlers: new Map<string, WriteHandler>(),
  caller: { workspacePath: "" }
}));

vi.mock("electron", () => ({
  ipcMain: { handle: (channel: string, handler: WriteHandler) => handlers.set(channel, handler) },
  shell: { trashItem: vi.fn() },
  BrowserWindow: { fromWebContents: () => ({ id: 1 }) },
  dialog: {},
  app: {}
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { getEntryByWebContents: () => caller, getEntryById: () => caller }
}));
vi.mock("../../apps/desktop/src/main/config", () => ({ configManager: {} }));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({ fileWatcherManager: {} }));
vi.mock("../../apps/desktop/src/main/ipc/watcher-handler", () => ({ registerWatcherHandlers: vi.fn() }));

import { fileSystem } from "../../apps/desktop/src/main/file-system";
import { writeExistingFile } from "../../apps/desktop/src/main/file-system/guarded-write";
import { registerWorkspaceHandlers } from "../../apps/desktop/src/main/ipc/workspace-handler";

beforeAll(() => registerWorkspaceHandlers());

describe("editor writes against a shared on-disk baseline", () => {
  let root: string;
  let workspace: string;
  let filePath: string;
  const event = { sender: {} } as Electron.IpcMainInvokeEvent;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-guarded-write-"));
    workspace = path.join(root, "workspace");
    await fs.mkdir(workspace);
    filePath = path.join(workspace, "note.md");
    await fs.writeFile(filePath, "original");
    caller.workspacePath = workspace;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(root, { recursive: true, force: true });
  });

  it("serializes writes through symlink aliases and rejects the second stale window", async () => {
    const alias = path.join(root, "workspace-alias");
    await fs.symlink(workspace, alias, process.platform === "win32" ? "junction" : "dir");
    let release!: () => void;
    let started!: () => void;
    const writing = new Promise<void>((resolve) => (started = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const writeAtomic = fileSystem.writeFileAtomic.bind(fileSystem);
    vi.spyOn(fileSystem, "writeFileAtomic").mockImplementationOnce(async (...args) => {
      started();
      await gate;
      await writeAtomic(...args);
    });
    const first = writeExistingFile(filePath, "first window draft", "original");
    await writing;
    const second = writeExistingFile(path.join(alias, "note.md"), "second window draft", "original");
    const rejected = expect(second).rejects.toMatchObject({ code: "FILE_CONTENT_CONFLICT" });
    release();

    await Promise.all([first, rejected]);

    expect(await fs.readFile(filePath, "utf8")).toBe("first window draft");
    await writeExistingFile(filePath, "resolved draft", "first window draft");
    expect(await fs.readFile(filePath, "utf8")).toBe("resolved draft");
  });

  it("returns a distinct conflict code over the real IPC handler without overwriting the file", async () => {
    await fs.writeFile(filePath, "outside draft");

    const result = await handlers.get("file:write")!(event, filePath, "local draft", "original");

    expect(result).toMatchObject({ ok: false, error: { code: "FILE_CONTENT_CONFLICT" } });
    expect(await fs.readFile(filePath, "utf8")).toBe("outside draft");
  });

  it("does not recreate a file removed while another window's save is queued", async () => {
    let release!: () => void;
    let started!: () => void;
    const writing = new Promise<void>((resolve) => (started = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const write = fileSystem.writeFile.bind(fileSystem);
    vi.spyOn(fileSystem, "writeFile").mockImplementationOnce(async (...args) => {
      const result = await write(...args);
      started();
      await gate;
      return result;
    });
    const first = writeExistingFile(filePath, "first draft", "original");
    await writing;
    const second = writeExistingFile(filePath, "queued draft", "first draft");
    const rejected = expect(second).rejects.toMatchObject({ code: "ENOENT" });
    await fs.unlink(filePath);
    release();

    await Promise.all([first, rejected]);

    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readdir(workspace)).toEqual([]);
  });

  it("keeps missing-file and workspace-boundary failures distinct from content conflicts", async () => {
    await fs.unlink(filePath);
    const missing = await handlers.get("file:write")!(event, filePath, "local draft", "original");
    expect(missing).toMatchObject({ ok: false, error: { code: "FILE_WRITE_FAILED" } });
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });

    const outside = path.join(root, "outside.md");
    await fs.writeFile(outside, "private outside draft");
    const denied = await handlers.get("file:write")!(event, outside, "local draft", "private outside draft");
    expect(denied).toMatchObject({ ok: false, error: { code: "FILE_WRITE_FAILED" } });
    expect(await fs.readFile(outside, "utf8")).toBe("private outside draft");
  });
});
