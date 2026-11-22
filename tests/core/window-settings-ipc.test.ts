import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHORTCUTS, type ShortcutConfig } from "../../apps/desktop/src/shared";

const { register, selectFile, getEntry, getEntries, findWorkspaceEntry, addRecent, getShortcuts, setShortcuts } =
  vi.hoisted(() => ({
    register: vi.fn(),
    selectFile: vi.fn(),
    getEntry: vi.fn(),
    getEntries: vi.fn(),
    findWorkspaceEntry: vi.fn(),
    addRecent: vi.fn(),
    getShortcuts: vi.fn(),
    setShortcuts: vi.fn()
  }));

vi.mock("electron", () => ({
  ipcMain: { handle: register },
  BrowserWindow: { fromWebContents: (sender: object) => getEntry(sender)?.window },
  dialog: { showOpenDialog: selectFile },
  app: {},
  shell: {}
}));
vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: { addRecentWorkspace: addRecent, getShortcuts, setShortcuts }
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { getEntryByWebContents: getEntry, getAllEntries: getEntries, findWorkspaceEntry }
}));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({}));
vi.mock("../../apps/desktop/src/main/ipc/watcher-handler", () => ({ registerWatcherHandlers: vi.fn() }));

import { registerWorkspaceHandlers } from "../../apps/desktop/src/main/ipc/workspace-handler";

function makeWindow(id: number) {
  const rendererUrl = "file:///app/renderer/index.html";
  const senderFrame = { url: rendererUrl };
  const sender = { mainFrame: senderFrame, isDestroyed: () => false, isLoadingMainFrame: () => false, send: vi.fn() };
  const window = { id, webContents: sender, isDestroyed: () => false, isMinimized: () => false, focus: vi.fn() };
  return { window, rendererUrl, event: { sender, senderFrame } };
}

describe("cross-window workspace and settings IPC", () => {
  const first = makeWindow(1);
  const second = makeWindow(2);
  let config: ShortcutConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    registerWorkspaceHandlers();
    getEntry.mockImplementation((sender) => [first, second].find((entry) => entry.window.webContents === sender));
    getEntries.mockReturnValue([first, second]);
    config = DEFAULT_SHORTCUTS;
    getShortcuts.mockImplementation(() => config);
    setShortcuts.mockImplementation((value: ShortcutConfig) => (config = value));
  });

  function handler(channel: string) {
    return register.mock.calls.find(([name]) => name === channel)![1];
  }

  it.each([1, 2])("routes a selected file to window %s using its scanned workspace path", async (windowId) => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-open-dialog-")));
    const workspace = path.join(root, "workspace");
    const alias = path.join(root, "alias");
    const nested = path.join(workspace, "nested");
    const filePath = path.join(nested, "second.md");
    try {
      await mkdir(nested, { recursive: true });
      await writeFile(filePath, "# second");
      await symlink(workspace, alias, process.platform === "win32" ? "junction" : "dir");
      const receiver = windowId === first.window.id ? first : second;
      selectFile.mockResolvedValue({ canceled: false, filePaths: [filePath] });
      findWorkspaceEntry.mockImplementation((candidate) =>
        candidate === workspace ? { ...receiver, scannedWorkspacePath: alias } : undefined
      );

      const payload = { workspacePath: alias, filePath: path.join(alias, "nested", "second.md") };
      const result = await handler("workspace:openFile")(first.event);
      if (receiver === first) {
        expect(result).toEqual({ ok: true, value: payload });
      } else {
        expect(result).toEqual({ ok: true, value: null });
        expect(second.window.focus).toHaveBeenCalledOnce();
        expect(second.window.webContents.send).toHaveBeenCalledWith("workspace:external-open", payload);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("merges different bindings saved by two windows and broadcasts the committed configuration", () => {
    const save = handler("config:setShortcut");
    const openSettings = { ...DEFAULT_SHORTCUTS.openSettings, code: "Period" };
    const toggleNoteSearch = { ...DEFAULT_SHORTCUTS.toggleNoteSearch, code: "KeyK" };
    expect(save(first.event, "openSettings", openSettings).ok).toBe(true);
    expect(save(second.event, "toggleNoteSearch", toggleNoteSearch)).toEqual({
      ok: true,
      value: { ...DEFAULT_SHORTCUTS, openSettings, toggleNoteSearch }
    });
    for (const { window } of [first, second]) {
      expect(window.webContents.send).toHaveBeenLastCalledWith("config:shortcutsChanged", config);
    }
  });
});
