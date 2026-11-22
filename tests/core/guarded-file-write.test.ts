import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type WriteHandler = (
  event: Electron.IpcMainInvokeEvent,
  filePath: string,
  content: string,
  expectedContent?: string,
  existingFileMessage?: string
) => Promise<IpcResultDTO<{ mtime: number }>>;

const { handlers, caller, saveDialog, showMessageBox } = vi.hoisted(() => ({
  handlers: new Map<string, WriteHandler>(),
  saveDialog: vi.fn(),
  showMessageBox: vi.fn(),
  caller: { workspacePath: "", rendererUrl: "file:///index.html", window: { webContents: {} as object } }
}));

vi.mock("electron", () => ({
  ipcMain: { handle: (channel: string, handler: WriteHandler) => handlers.set(channel, handler) },
  shell: { trashItem: vi.fn() },
  BrowserWindow: { fromWebContents: () => ({ id: 1 }) },
  dialog: { showSaveDialog: saveDialog, showMessageBox },
  app: { getPath: () => os.tmpdir() }
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
  const senderFrame = { url: caller.rendererUrl };
  const event = {
    sender: { isDestroyed: () => false, mainFrame: senderFrame },
    senderFrame
  } as Electron.IpcMainInvokeEvent;
  caller.window.webContents = event.sender;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "zhiyuan-guarded-write-"));
    workspace = path.join(root, "workspace");
    await fs.mkdir(workspace);
    filePath = path.join(workspace, "note.md");
    await fs.writeFile(filePath, "original");
    caller.workspacePath = workspace;
    saveDialog.mockReset();
    showMessageBox.mockReset();
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
    expect(missing).toMatchObject({ ok: false, error: { code: "FILE_NOT_FOUND" } });
    await expect(fs.stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });

    const outside = path.join(root, "outside.md");
    await fs.writeFile(outside, "private outside draft");
    const denied = await handlers.get("file:write")!(event, outside, "local draft", "private outside draft");
    expect(denied).toMatchObject({ ok: false, error: { code: "FILE_WRITE_FAILED" } });
    expect(await fs.readFile(outside, "utf8")).toBe("private outside draft");
  });

  it("distinguishes unreadable files from missing files over IPC", async () => {
    const read = handlers.get("file:read")!;
    vi.spyOn(fileSystem, "readFile").mockRejectedValueOnce(
      Object.assign(new Error("Permission denied"), { code: "EACCES" })
    );
    expect(await read(event, filePath, "")).toMatchObject({ ok: false, error: { code: "FILE_READ_FAILED" } });
    await fs.unlink(filePath);
    expect(await read(event, filePath, "")).toMatchObject({ ok: false, error: { code: "FILE_NOT_FOUND" } });
  });

  it("reports an editor note as missing after a directory replaces it", async () => {
    await fs.unlink(filePath);
    await fs.mkdir(filePath);
    const otherFile = path.join(filePath, "keep.md");
    await fs.writeFile(otherFile, "independent contents");

    expect(await handlers.get("file:read")!(event, filePath, "")).toMatchObject({
      ok: false,
      error: { code: "FILE_NOT_FOUND" }
    });
    expect(await handlers.get("file:write")!(event, filePath, "draft", "original")).toMatchObject({
      ok: false,
      error: { code: "FILE_NOT_FOUND" }
    });
    expect(await fs.readFile(otherFile, "utf8")).toBe("independent contents");
  });

  it("recovers a missing workspace's draft only through the approved destination", async () => {
    await fs.rename(workspace, path.join(root, "moved"));
    expect(await handlers.get("file:read")!(event, filePath, "")).toMatchObject({
      ok: false,
      error: { code: "FILE_NOT_FOUND" }
    });
    expect(await handlers.get("file:write")!(event, filePath, "draft", "original")).toMatchObject({
      ok: false,
      error: { code: "FILE_NOT_FOUND" }
    });
    const outside = path.join(root, "recovered.md");
    expect(await handlers.get("file:create")!(event, outside, "draft")).toMatchObject({ ok: false });
    const saveDraftAs = handlers.get("file:saveDraftAs")!;
    saveDialog.mockResolvedValueOnce({ canceled: true });
    expect(await saveDraftAs(event, "recovered.md", "draft", "Save draft as")).toEqual({ ok: true, value: false });
    await expect(fs.stat(outside)).rejects.toMatchObject({ code: "ENOENT" });

    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: outside });
    expect(await saveDraftAs(event, "recovered.md", "draft", "Save draft as")).toEqual({ ok: true, value: true });
    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: outside }).mockResolvedValueOnce({ canceled: true });
    expect(await saveDraftAs(event, "recovered.md", "another draft", "Save draft as")).toEqual({
      ok: true,
      value: false
    });
    expect(await fs.readFile(outside, "utf8")).toBe("draft");
    expect(await fs.readFile(path.join(root, "moved", "note.md"), "utf8")).toBe("original");
  });

  it("lets the user select a new name within the same Save Draft As when the first one already exists", async () => {
    const output = path.join(root, "recovered.md");
    const destination = path.join(root, "draft.md");
    await fs.writeFile(output, "existing file");
    saveDialog
      .mockResolvedValueOnce({ canceled: false, filePath: output })
      .mockResolvedValueOnce({ canceled: false, filePath: destination });

    const saveDraftAs = handlers.get("file:saveDraftAs")!;
    expect(await saveDraftAs(event, "draft.md", "draft", "Save draft as", "Choose a new name.")).toEqual({
      ok: true,
      value: true
    });
    expect(showMessageBox).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({ message: "Choose a new name." })
    );
    expect(saveDialog).toHaveBeenCalledTimes(2);
    expect(await fs.readFile(output, "utf8")).toBe("existing file");
    expect(await fs.readFile(destination, "utf8")).toBe("draft");
  });

  it("removes a partially written recovery draft and allows retrying the selected filename", async () => {
    const output = path.join(root, "recovered.md");
    const draft = "complete draft";
    const saveDraftAs = handlers.get("file:saveDraftAs")!;
    const write = fs.writeFile;
    vi.spyOn(fs, "writeFile").mockImplementationOnce(async (stagedPath, _content, options) => {
      await write(stagedPath, "partial", options);
      throw Object.assign(new Error("Disk quota exceeded"), { code: "EDQUOT" });
    });
    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: output });
    expect(await saveDraftAs(event, "recovered.md", draft, "Save draft as")).toMatchObject({
      ok: false,
      error: { code: "FILE_SAVE_DRAFT_FAILED" }
    });
    expect(await fs.readdir(root)).toEqual(["workspace"]);

    saveDialog.mockResolvedValueOnce({ canceled: false, filePath: output });
    expect(await saveDraftAs(event, "recovered.md", draft, "Save draft as")).toEqual({ ok: true, value: true });
    expect(await fs.readFile(output, "utf8")).toBe(draft);
    expect((await fs.readdir(root)).sort()).toEqual(["recovered.md", "workspace"]);
  });

  it("reports a blocked parent as missing only inside the approved workspace", async () => {
    const parent = path.join(workspace, "folder");
    const nestedFile = path.join(parent, "note.md");
    await fs.mkdir(parent);
    await fs.writeFile(nestedFile, "original");
    await fs.rename(parent, path.join(workspace, "moved-folder"));
    await fs.writeFile(parent, "replacement file");
    expect(await handlers.get("file:write")!(event, nestedFile, "draft", "original")).toMatchObject({
      ok: false,
      error: { code: "FILE_NOT_FOUND" }
    });
    expect(await handlers.get("file:create")!(event, nestedFile, "draft")).toMatchObject({ ok: false });
    expect(await fs.readFile(parent, "utf8")).toBe("replacement file");
    expect(await fs.readFile(path.join(workspace, "moved-folder", "note.md"), "utf8")).toBe("original");

    const outside = path.join(root, "outside.txt");
    await fs.writeFile(outside, "outside");
    expect(await handlers.get("file:write")!(event, path.join(outside, "note.md"), "draft", "original")).toMatchObject({
      ok: false,
      error: { code: "FILE_WRITE_FAILED" }
    });
  });

  it("saves an existing note with a filename near the filesystem limit", async () => {
    const longPath = path.join(workspace, `${"a".repeat(245)}.md`);
    await fs.rename(filePath, longPath);

    const result = await handlers.get("file:write")!(event, longPath, "edited", "original");

    expect(result).toMatchObject({ ok: true });
    expect(await fs.readFile(longPath, "utf8")).toBe("edited");
    expect(await fs.readdir(workspace)).toEqual([path.basename(longPath)]);
  });
});
