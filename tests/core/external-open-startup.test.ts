import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state, createWindow, send, recent, addRecent } = vi.hoisted(() => ({
  state: {
    ready: false,
    finishReady: () => {},
    handlers: new Map<string, (...args: unknown[]) => unknown>()
  },
  createWindow: vi.fn(),
  send: vi.fn(),
  recent: vi.fn(),
  addRecent: vi.fn()
}));

vi.mock("electron", () => ({
  app: {
    requestSingleInstanceLock: () => true,
    isReady: () => state.ready,
    whenReady: () =>
      new Promise<void>((resolve) => {
        state.finishReady = () => {
          state.ready = true;
          resolve();
        };
      }),
    on: (event: string, handler: (...args: unknown[]) => unknown) => state.handlers.set(event, handler),
    quit: vi.fn()
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { handle: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  net: { fetch: vi.fn() }
}));
vi.mock("@electron-toolkit/utils", () => ({
  electronApp: { setAppUserModelId: vi.fn() },
  optimizer: { watchWindowShortcuts: vi.fn() }
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { createWindow, getWindowsForWorkspace: () => [] }
}));
vi.mock("../../apps/desktop/src/main/config", () => ({
  configManager: { getRecentWorkspaces: recent, addRecentWorkspace: addRecent }
}));
vi.mock("../../apps/desktop/src/main/theme", () => ({ themeManager: { init: vi.fn() } }));
vi.mock("../../apps/desktop/src/main/menu", () => ({ setupApplicationMenu: vi.fn() }));
vi.mock("../../apps/desktop/src/main/diagnostics", () => ({
  initializeDiagnostics: vi.fn(),
  recordDiagnostic: vi.fn()
}));
vi.mock("../../apps/desktop/src/main/ipc/theme-handler", () => ({ registerThemeHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/workspace-handler", () => ({ registerWorkspaceHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/window-handler", () => ({ registerWindowHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/rss-handler", () => ({ registerRssHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/url-handler", () => ({ registerUrlHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/github-handler", () => ({ registerGitHubHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/terminal-handler", () => ({ registerTerminalHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/ipc/diagnostics-handler", () => ({ registerDiagnosticsHandlers: vi.fn() }));
vi.mock("../../apps/desktop/src/main/export", () => ({ registerExportHandlers: vi.fn() }));

describe("external file opening at application startup", () => {
  const processEvents: NodeJS.EventEmitter = process;
  let root: string;
  let notePath: string;
  let oldWorkspace: string;
  const originalArgv = process.argv;
  const originalPlatform = process.platform;
  const originalDefaultApp = Object.getOwnPropertyDescriptor(process, "defaultApp");
  let previousListeners: Map<string, Set<(...args: never[]) => void>>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("ZHIYUAN_SMOKE_TEST", "");
    state.ready = false;
    state.handlers.clear();
    previousListeners = new Map(
      ["uncaughtExceptionMonitor", "unhandledRejection"].map((event) => [
        event,
        new Set(processEvents.listeners(event) as Array<(...args: never[]) => void>)
      ])
    );
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-external-startup-"));
    oldWorkspace = path.join(root, "old");
    await mkdir(oldWorkspace);
    notePath = path.join(root, "associated.md");
    await writeFile(notePath, "# associated file");
    recent.mockReturnValue([oldWorkspace]);
    createWindow.mockReturnValue({
      webContents: { isLoadingMainFrame: () => false, send },
      isMinimized: () => false,
      focus: vi.fn()
    });
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    Object.defineProperty(process, "defaultApp", { value: false, configurable: true });
  });

  afterEach(async () => {
    process.argv = originalArgv;
    Object.defineProperty(process, "platform", { value: originalPlatform });
    if (originalDefaultApp) Object.defineProperty(process, "defaultApp", originalDefaultApp);
    else Reflect.deleteProperty(process, "defaultApp");
    for (const [event, listeners] of previousListeners) {
      for (const listener of processEvents.listeners(event)) {
        if (!listeners.has(listener as (...args: never[]) => void)) {
          processEvents.removeListener(event, listener as (...args: unknown[]) => void);
        }
      }
    }
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  async function finishStartup() {
    state.finishReady();
    await Promise.resolve();
    await Promise.resolve();
  }

  it("opens an associated Markdown file on a cold packaged launch instead of restoring the previous workspace", async () => {
    process.argv = ["Zhiyuan.exe", notePath];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
    expect(addRecent).toHaveBeenCalledWith(root);
  });

  it("skips the Electron development app argument on cold launch", async () => {
    Object.defineProperty(process, "defaultApp", { value: true });
    process.argv = ["electron", oldWorkspace, notePath];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
  });

  it("does not open Chromium switches or their directory values as workspaces", async () => {
    process.argv = ["Zhiyuan.exe", "--user-data-dir", oldWorkspace, "--no-sandbox", notePath];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
  });

  it("uses the same argument handling for a second development instance", async () => {
    Object.defineProperty(process, "defaultApp", { value: true });
    process.argv = ["electron", oldWorkspace];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();
    createWindow.mockClear();

    state.handlers.get("second-instance")?.({}, ["electron", oldWorkspace, notePath]);

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
  });

  it("continues queueing macOS open-file events received before readiness", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.argv = ["Zhiyuan"];
    await import("../../apps/desktop/src/main/index");
    const event = { preventDefault: vi.fn() };
    state.handlers.get("open-file")?.(event, notePath);
    await finishStartup();

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
  });

  it("resolves relative second-instance file arguments against that instance's working directory", async () => {
    process.argv = ["Zhiyuan.exe"];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();
    createWindow.mockClear();

    state.handlers.get("second-instance")?.({}, ["Zhiyuan.exe", path.basename(notePath)], root);

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: notePath });
  });

  it("does not open the same startup file twice when macOS also emits open-file", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.argv = ["Zhiyuan", notePath];
    await import("../../apps/desktop/src/main/index");
    state.handlers.get("open-file")?.({ preventDefault: vi.fn() }, notePath);
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
