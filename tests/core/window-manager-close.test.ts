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

describe("window close interception", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const entry of windowManager.getAllEntries()) entry.window.emit("closed");
    vi.clearAllTimers();
    vi.useRealTimers();
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

  it("gives each window an independent resource capability and invalidates it on close", () => {
    const first = windowManager.createWindow("/workspace-a");
    const second = windowManager.createWindow("/workspace-b");
    const firstToken = windowManager.getEntryById(first.id)!.localResourceToken;
    const secondToken = windowManager.getEntryById(second.id)!.localResourceToken;
    expect(firstToken).toMatch(/^[a-f0-9]{64}$/);
    expect(secondToken).not.toBe(firstToken);
    expect(windowManager.getWorkspaceForResourceToken(firstToken)).toBe("/workspace-a");
    first.emit("closed");
    expect(windowManager.getWorkspaceForResourceToken(firstToken)).toBeNull();
    expect(windowManager.getWorkspaceForResourceToken(secondToken)).toBe("/workspace-b");
    vi.mocked(second.isDestroyed).mockReturnValue(true);
    expect(windowManager.getWorkspaceForResourceToken(secondToken)).toBeNull();
  });
});
