import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";

const { watchMock } = vi.hoisted(() => ({ watchMock: vi.fn() }));
vi.mock("chokidar", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    default: {
      watch: watchMock.mockImplementation(() => Object.assign(new EventEmitter(), { close: vi.fn() }))
    }
  };
});
vi.mock("electron", () => ({ BrowserWindow: { fromId: vi.fn() } }));

import { fileWatcherManager } from "../../apps/desktop/src/main/file-watcher";
import { MAX_WORKSPACE_DEPTH } from "../../apps/desktop/src/main/workspace/policy";

const workspace = path.join(os.tmpdir(), "zhiyuan-watcher-depth-test");
afterEach(() => {
  fileWatcherManager.stopWatching(workspace, 1);
  vi.clearAllMocks();
});

describe("workspace watcher discovery", () => {
  it("watches markdown at the deepest scanned directory without descending another level", () => {
    fileWatcherManager.startWatching(workspace, 1);
    const ignore = watchMock.mock.calls[0][1].ignored as (target: string, stats?: fs.Stats) => boolean;
    const deepestDirectory = path.join(
      workspace,
      ...Array.from({ length: MAX_WORKSPACE_DEPTH }, (_, index) => `d${index}`)
    );
    const fileStats = { isFile: () => true, isDirectory: () => false } as fs.Stats;
    const directoryStats = { isFile: () => false, isDirectory: () => true } as fs.Stats;

    expect(ignore(deepestDirectory, directoryStats)).toBe(false);
    expect(ignore(path.join(deepestDirectory, "note.md"))).toBe(false);
    expect(ignore(path.join(deepestDirectory, "note.md"), fileStats)).toBe(false);
    expect(ignore(path.join(deepestDirectory, "deeper"), directoryStats)).toBe(true);
    expect(ignore(path.join(deepestDirectory, "deeper", "note.md"), fileStats)).toBe(true);
  });

  it("shares a canonical watcher while keeping each window's scan paths in event payloads", () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "zhiyuan-watcher-alias-"));
    const actual = path.join(root, "actual");
    const alias = path.join(root, "alias");
    fs.mkdirSync(actual);
    fs.symlinkSync(actual, alias, process.platform === "win32" ? "junction" : "dir");
    const sendActual = vi.fn();
    const sendAlias = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockImplementation(
      (id) =>
        ({
          isDestroyed: () => false,
          webContents: { send: id === 1 ? sendActual : sendAlias }
        }) as unknown as BrowserWindow
    );
    try {
      fileWatcherManager.startWatching(actual, 1);
      fileWatcherManager.startWatching(alias, 2);
      expect(watchMock).toHaveBeenCalledTimes(1);
      const watcher = watchMock.mock.results[0].value;
      watcher.emit("change", path.join(actual, "note.md"));

      expect(sendActual).toHaveBeenCalledWith("file:changed", {
        filePath: "note.md",
        fullPath: path.join(actual, "note.md")
      });
      expect(sendAlias).toHaveBeenCalledWith("file:changed", {
        filePath: "note.md",
        fullPath: path.join(alias, "note.md")
      });
    } finally {
      fileWatcherManager.stopWatching(actual, 1);
      fileWatcherManager.stopWatching(actual, 2);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("replays coalesced changes when a window releases its last pause", async () => {
    const send = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    } as unknown as BrowserWindow);
    fileWatcherManager.startWatching(workspace, 1);
    fileWatcherManager.pauseWatching(workspace, 1);
    fileWatcherManager.pauseWatching(workspace, 1);
    const watcher = watchMock.mock.results[0].value;
    const added = path.join(workspace, "new.md");
    const changed = path.join(workspace, "edited.md");
    watcher.emit("add", added);
    watcher.emit("change", changed);
    watcher.emit("change", added);
    watcher.emit("change", changed);
    await fileWatcherManager.resumeWatching(workspace, 1);
    expect(send).not.toHaveBeenCalled();

    await fileWatcherManager.resumeWatching(workspace, 1);

    expect(send.mock.calls).toEqual([
      ["file:added", { filePath: "new.md", fullPath: added }],
      ["file:changed", { filePath: "edited.md", fullPath: changed }]
    ]);
    await fileWatcherManager.resumeWatching(workspace, 1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("refreshes replaced notes and folders instead of replaying stale deletions", async () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "zhiyuan-watcher-replay-"));
    const replacedNote = path.join(root, "replaced.md");
    const deletedNote = path.join(root, "deleted.md");
    const replacedFolder = path.join(root, "replaced");
    const send = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    } as unknown as BrowserWindow);
    try {
      fileWatcherManager.startWatching(root, 1);
      fileWatcherManager.pauseWatching(root, 1);
      const watcher = watchMock.mock.results[0].value;
      watcher.emit("unlink", replacedNote);
      watcher.emit("unlinkDir", replacedFolder);
      watcher.emit("unlink", deletedNote);
      fs.writeFileSync(replacedNote, "replacement");
      fs.mkdirSync(replacedFolder);

      await fileWatcherManager.resumeWatching(root, 1);

      expect(send.mock.calls).toEqual([
        ["file:added", { filePath: "replaced.md", fullPath: replacedNote }],
        ["folder:added", { folderPath: "replaced", fullPath: replacedFolder }],
        ["file:deleted", { filePath: "deleted.md", fullPath: deletedNote }]
      ]);
    } finally {
      fileWatcherManager.stopWatching(root, 1);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes old spellings after a case-only directory rename", async () => {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "zhiyuan-watcher-case-"));
    const oldFolder = path.join(root, "Example");
    const newFolder = path.join(root, "example");
    const temporary = path.join(root, "temporary");
    const oldNote = path.join(oldFolder, "note.md");
    const newNote = path.join(newFolder, "note.md");
    const send = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    } as unknown as BrowserWindow);
    try {
      fs.mkdirSync(oldFolder);
      fs.writeFileSync(oldNote, "note");
      fileWatcherManager.startWatching(root, 1);
      fileWatcherManager.pauseWatching(root, 1);
      const watcher = watchMock.mock.results[0].value;
      fs.renameSync(oldFolder, temporary);
      fs.renameSync(temporary, newFolder);
      // Simulate a case-insensitive volume whose realpath preserves the requested spelling.
      const aliases = new Map([
        [oldFolder, newFolder],
        [oldNote, newNote]
      ]);
      const lstat = fs.promises.lstat;
      const realpath = fs.realpathSync.native;
      vi.spyOn(fs.promises, "lstat").mockImplementation(((file, options) =>
        lstat(aliases.get(String(file)) ?? file, options)) as typeof lstat);
      vi.spyOn(fs.realpathSync, "native").mockImplementation(((file, options) =>
        aliases.has(String(file)) ? String(file) : realpath(file, options)) as typeof realpath);
      watcher.emit("unlink", oldNote);
      watcher.emit("unlinkDir", oldFolder);
      watcher.emit("addDir", newFolder);
      watcher.emit("add", newNote);

      await fileWatcherManager.resumeWatching(root, 1);

      expect(send.mock.calls).toEqual([
        ["file:deleted", { filePath: "Example/note.md", fullPath: oldNote }],
        ["folder:deleted", { folderPath: "Example", fullPath: oldFolder }],
        ["folder:added", { folderPath: "example", fullPath: newFolder }],
        ["file:added", { filePath: "example/note.md", fullPath: newNote }]
      ]);
    } finally {
      vi.restoreAllMocks();
      fileWatcherManager.stopWatching(root, 1);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rechecks superseded deletions without sending later events ahead of them", async () => {
    const send = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    } as unknown as BrowserWindow);
    const first = path.join(workspace, "replaced.md");
    const second = path.join(workspace, "next.md");
    const late = path.join(workspace, "late.md");
    let readStarted!: () => void;
    let finishRead!: () => void;
    const started = new Promise<void>((resolve) => (readStarted = resolve));
    const reading = new Promise<void>((resolve) => (finishRead = resolve));
    const lstat = vi.spyOn(fs.promises, "lstat").mockImplementationOnce(async () => {
      readStarted();
      await reading;
      throw Object.assign(new Error("File was missing"), { code: "ENOENT" });
    });
    fileWatcherManager.startWatching(workspace, 1);
    fileWatcherManager.pauseWatching(workspace, 1);
    const watcher = watchMock.mock.results[0].value;
    watcher.emit("unlink", first);
    watcher.emit("add", second);
    const replay = fileWatcherManager.resumeWatching(workspace, 1);
    try {
      await started;
      watcher.emit("change", first);
      watcher.emit("change", late);
      expect(send).not.toHaveBeenCalled();
      finishRead();
      await replay;
      expect(send.mock.calls).toEqual([
        ["file:added", { filePath: "replaced.md", fullPath: first }],
        ["file:added", { filePath: "next.md", fullPath: second }],
        ["file:changed", { filePath: "late.md", fullPath: late }]
      ]);
    } finally {
      finishRead();
      await replay.catch(() => {});
      lstat.mockRestore();
    }
  });

  it("bounds asynchronous deletion checks and delivers a large replay in order", async () => {
    const send = vi.fn();
    vi.mocked(BrowserWindow.fromId).mockReturnValue({
      isDestroyed: () => false,
      webContents: { send }
    } as unknown as BrowserWindow);
    let checking = 0;
    let peak = 0;
    const lstat = vi.spyOn(fs.promises, "lstat").mockImplementation(async () => {
      checking++;
      peak = Math.max(peak, checking);
      await setImmediate();
      checking--;
      throw Object.assign(new Error("File was deleted"), { code: "ENOENT" });
    });
    try {
      fileWatcherManager.startWatching(workspace, 1);
      fileWatcherManager.pauseWatching(workspace, 1);
      const watcher = watchMock.mock.results[0].value;
      const names = Array.from({ length: 40 }, (_, index) => `note-${index}.md`);
      for (const name of names) watcher.emit("unlink", path.join(workspace, name));
      await fileWatcherManager.resumeWatching(workspace, 1);

      expect(peak).toBeGreaterThan(1);
      expect(peak).toBeLessThan(names.length);
      expect(send.mock.calls.map(([channel, data]) => [channel, data.filePath])).toEqual(
        names.map((name) => ["file:deleted", name])
      );
    } finally {
      lstat.mockRestore();
    }
  });
});
