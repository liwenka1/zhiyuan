import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  let nextWindowId = 1;
  class BrowserWindow extends EventEmitter {
    id = nextWindowId++;
    webContents = Object.assign(new EventEmitter(), { send: vi.fn(), setWindowOpenHandler: vi.fn() });
    setTitle = vi.fn();
    setRepresentedFilename = vi.fn();
    loadFile = vi.fn();
    loadURL = vi.fn();
    isDestroyed = vi.fn(() => false);
    show = vi.fn();
    close = vi.fn(() => {
      const event = { preventDefault: vi.fn() };
      this.emit("close", event);
      if (!event.preventDefault.mock.calls.length) this.destroy();
    });
    destroy = vi.fn(() => this.emit("closed"));
  }
  return {
    BrowserWindow,
    app: { name: "test" },
    shell: { openExternal: vi.fn() },
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1280, height: 800 } }) }
  };
});
vi.mock("@electron-toolkit/utils", () => ({ is: { dev: false } }));
vi.mock("../../apps/desktop/src/main/theme", () => ({ themeManager: { getTheme: () => "light" } }));
vi.mock("../../apps/desktop/src/main/config", () => ({ configManager: { addRecentWorkspace: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({ fileWatcherManager: { stopWatching: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/diagnostics", () => ({ recordDiagnostic: vi.fn() }));

import { windowManager } from "../../apps/desktop/src/main/window-manager";
import { findOpenTargetWindow } from "../../apps/desktop/src/main/external-open";
import { resolveMarkdownOpenTarget } from "../../apps/desktop/src/main/workspace/open-target";

describe("managed windows", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const entry of windowManager.getAllEntries()) entry.window.emit("closed");
    windowManager.takeQuitRequest();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("navigates to the same renderer URL used by the IPC guard", () => {
    const win = windowManager.createWindow();
    expect(win.loadURL).toHaveBeenCalledExactlyOnceWith(windowManager.getEntryById(win.id)!.rendererUrl);
    expect(windowManager.getEntryById(win.id)!.rendererUrl).toMatch(/^file:.*\/renderer\/index\.html$/);
  });

  it("invalidates the source revision at switch start while keeping the workspace bound", () => {
    const first = path.resolve("first-workspace");
    const second = path.resolve("second-workspace");
    const win = windowManager.createWindow(first);
    windowManager.setWorkspacePath(win.id, first);
    const original = windowManager.getEntryById(win.id)!.workspaceRevision;

    windowManager.beginWorkspaceSwitch(win.id, first);
    expect(windowManager.getEntryById(win.id)!.workspaceRevision).toBe(original);
    windowManager.beginWorkspaceSwitch(win.id, second);
    expect(windowManager.getEntryById(win.id)).toMatchObject({
      workspacePath: first,
      scannedWorkspacePath: first,
      workspaceRevision: original + 1
    });
  });

  it("routes a nested note using the workspace root the window scanned", async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-window-scan-")));
    const workspace = path.join(root, "actual");
    const nested = path.join(workspace, "subfolder");
    const filePath = path.join(nested, "note.md");
    const alias = path.join(root, "alias");
    try {
      await mkdir(nested, { recursive: true });
      await writeFile(filePath, "# Nested");
      await symlink(workspace, alias, process.platform === "win32" ? "junction" : "dir");
      const win = windowManager.createWindow();
      windowManager.setWorkspacePath(win.id, alias);

      expect(windowManager.getEntryById(win.id)!.workspacePath).toBe(workspace);
      expect(findOpenTargetWindow(resolveMarkdownOpenTarget(filePath))).toEqual({
        window: win,
        payload: { workspacePath: alias, filePath: path.join(alias, "subfolder", "note.md") }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["removed", "retargeted"])("routes using the real workspace if its scanned alias was %s", async (change) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-window-alias-")));
    const workspace = path.join(root, "workspace");
    const unfamiliar = path.join(root, "unrelated");
    const alias = path.join(root, "alias");
    const filePath = path.join(workspace, "nested", "note.md");
    const linkType = process.platform === "win32" ? "junction" : "dir";
    try {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "# Nested");
      await symlink(workspace, alias, linkType);
      const win = windowManager.createWindow();
      windowManager.setWorkspacePath(win.id, alias);
      await rm(alias, { recursive: true, force: true });
      if (change === "retargeted") {
        await mkdir(unfamiliar);
        await symlink(unfamiliar, alias, linkType);
      }

      expect(findOpenTargetWindow(resolveMarkdownOpenTarget(filePath))).toEqual({
        window: win,
        payload: { workspacePath: workspace, filePath }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows a welcome window to close even when the renderer never registered a listener", () => {
    const win = windowManager.createWindow();
    const event = { preventDefault: vi.fn() };
    win.emit("close", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it("still intercepts workspace close while waiting for note saves", () => {
    const win = windowManager.createWindow("/workspace");
    const event = { preventDefault: vi.fn() };
    win.emit("close", event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.webContents.send).toHaveBeenCalledWith("window:prepare-close", 1);
  });

  it("retains an explicit quit across all renderer save handshakes", () => {
    const first = windowManager.createWindow("/workspace-first");
    const second = windowManager.createWindow("/workspace-second");
    const welcome = windowManager.createWindow();
    const event = { preventDefault: vi.fn() };

    windowManager.deferQuit(event);
    windowManager.deferQuit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(first.webContents.send).toHaveBeenCalledExactlyOnceWith("window:prepare-close", 1);
    expect(second.webContents.send).toHaveBeenCalledExactlyOnceWith("window:prepare-close", 1);
    expect(welcome.destroy).toHaveBeenCalledOnce();
    windowManager.allowClose(first.id, 1);
    windowManager.allowClose(second.id, 1);
    expect(windowManager.getWindowCount()).toBe(0);
    expect(windowManager.takeQuitRequest()).toBe(true);
    expect(windowManager.takeQuitRequest()).toBe(false);
  });

  it("cancels the quit request when a renderer does not acknowledge the save", () => {
    const win = windowManager.createWindow("/workspace");
    windowManager.deferQuit({ preventDefault: vi.fn() });

    vi.runAllTimers();

    expect(win.show).toHaveBeenCalledOnce();
    expect(win.destroy).not.toHaveBeenCalled();
    expect(windowManager.takeQuitRequest()).toBe(false);
  });

  it("includes a workspace opened during shutdown in the next quit request", () => {
    const original = windowManager.createWindow("/workspace-original");
    const event = { preventDefault: vi.fn() };
    windowManager.deferQuit(event);

    const added = windowManager.createWindow("/workspace-new");
    windowManager.deferQuit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(original.webContents.send).toHaveBeenCalledExactlyOnceWith("window:prepare-close", 1);
    expect(added.webContents.send).toHaveBeenCalledExactlyOnceWith("window:prepare-close", 1);
    windowManager.allowClose(original.id, 1);
    windowManager.allowClose(added.id, 1);
    expect(windowManager.getWindowCount()).toBe(0);
    expect(windowManager.takeQuitRequest()).toBe(true);
  });

  it("gives each window an independent resource capability and invalidates it on close", () => {
    const first = windowManager.createWindow("/workspace-a");
    const second = windowManager.createWindow("/workspace-b");
    const firstToken = windowManager.getEntryById(first.id)!.localResourceToken;
    const secondToken = windowManager.getEntryById(second.id)!.localResourceToken;
    expect(firstToken).toMatch(/^[a-f0-9]{64}$/);
    expect(secondToken).not.toBe(firstToken);
    expect(windowManager.getWorkspaceForResourceToken(firstToken)).toEqual({
      workspacePath: "/workspace-a",
      scannedWorkspacePath: null
    });
    first.emit("closed");
    expect(windowManager.getWorkspaceForResourceToken(firstToken)).toBeNull();
    expect(windowManager.getWorkspaceForResourceToken(secondToken)).toEqual({
      workspacePath: "/workspace-b",
      scannedWorkspacePath: null
    });
    vi.mocked(second.isDestroyed).mockReturnValue(true);
    expect(windowManager.getWorkspaceForResourceToken(secondToken)).toBeNull();
  });
});
