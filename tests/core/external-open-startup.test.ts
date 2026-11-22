import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { state, createWindow, findWorkspaceEntry, send, recent, addRecent } = vi.hoisted(() => ({
  state: {
    ready: false,
    finishReady: () => {},
    handlers: new Map<string, (...args: unknown[]) => unknown>()
  },
  createWindow: vi.fn(),
  findWorkspaceEntry: vi.fn(),
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
  windowManager: { createWindow, findWorkspaceEntry }
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
    findWorkspaceEntry.mockReset();
    previousListeners = new Map(
      ["uncaughtExceptionMonitor", "unhandledRejection"].map((event) => [
        event,
        new Set(processEvents.listeners(event) as Array<(...args: never[]) => void>)
      ])
    );
    root = await realpath(await mkdtemp(path.join(os.tmpdir(), "zhiyuan-external-startup-")));
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

  it("delivers both a root note and a nested note to the same startup window", async () => {
    const nested = path.join(root, "subfolder");
    await mkdir(nested);
    const secondNote = path.join(nested, "second.md");
    await writeFile(secondNote, "# second");
    findWorkspaceEntry.mockImplementation((workspace) =>
      workspace === root && createWindow.mock.results.length
        ? { window: createWindow.mock.results[0].value }
        : undefined
    );
    process.argv = ["Zhiyuan.exe", notePath];
    await import("../../apps/desktop/src/main/index");
    state.handlers.get("open-file")?.({ preventDefault: vi.fn() }, secondNote);
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenNthCalledWith(1, "workspace:external-open", { workspacePath: root, filePath: notePath });
    expect(send).toHaveBeenNthCalledWith(2, "workspace:external-open", { workspacePath: root, filePath: secondNote });
  });

  it("routes a nested file to its open workspace and restores that window", async () => {
    const nested = path.join(oldWorkspace, "subfolder");
    await mkdir(nested);
    const filePath = path.join(nested, "target.md");
    await writeFile(filePath, "# nested file");
    process.argv = ["Zhiyuan.exe"];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();
    const existing = createWindow.mock.results[0].value;
    existing.isMinimized = () => true;
    existing.restore = vi.fn();
    findWorkspaceEntry.mockImplementation((workspace) =>
      workspace === oldWorkspace ? { window: existing } : undefined
    );

    state.handlers.get("second-instance")?.({}, ["Zhiyuan.exe", filePath], root);

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(oldWorkspace);
    expect(existing.restore).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: oldWorkspace, filePath });
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

  async function createAliasedNote() {
    const workspace = path.join(root, "workspace");
    const alias = path.join(root, "workspace-alias");
    await mkdir(workspace);
    const target = path.join(workspace, "target.md");
    await writeFile(target, "# canonical fixture");
    await symlink(workspace, alias, originalPlatform === "win32" ? "junction" : "dir");
    return { workspace: await realpath(workspace), target: await realpath(target), alias };
  }

  it("uses the same real file identity as the workspace scanner for a cold symlink alias", async () => {
    const fixture = await createAliasedNote();
    process.argv = ["Zhiyuan.exe", path.join(fixture.alias, "target.md")];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(fixture.workspace);
    expect(send).toHaveBeenCalledWith("workspace:external-open", {
      workspacePath: fixture.workspace,
      filePath: fixture.target
    });
    expect(addRecent).toHaveBeenCalledWith(fixture.workspace);
  });

  it("uses the note's actual filename when a cold open uses different casing", async ({ skip }) => {
    const actual = path.join(root, "Note.md");
    const alternate = path.join(root, "note.md");
    await writeFile(actual, "# case-sensitive ID");
    if (!(await stat(alternate).catch(() => null))) {
      skip("Requires a case-insensitive filesystem");
      return;
    }
    process.argv = ["Zhiyuan.exe", alternate];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(root);
    expect(send).toHaveBeenCalledWith("workspace:external-open", { workspacePath: root, filePath: actual });
  });

  it("canonicalizes a second-instance relative alias against the caller's working directory", async () => {
    const fixture = await createAliasedNote();
    process.argv = ["Zhiyuan.exe"];
    await import("../../apps/desktop/src/main/index");
    await finishStartup();
    createWindow.mockClear();

    state.handlers.get("second-instance")?.({}, ["Zhiyuan.exe", "workspace-alias/target.md"], root);

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(fixture.workspace);
    expect(send).toHaveBeenCalledWith("workspace:external-open", {
      workspacePath: fixture.workspace,
      filePath: fixture.target
    });
  });

  it("deduplicates a macOS alias open-file event against its canonical startup argument", async () => {
    const fixture = await createAliasedNote();
    Object.defineProperty(process, "platform", { value: "darwin" });
    process.argv = ["Zhiyuan", fixture.target];
    await import("../../apps/desktop/src/main/index");
    state.handlers.get("open-file")?.({ preventDefault: vi.fn() }, path.join(fixture.alias, "target.md"));
    await finishStartup();

    expect(createWindow).toHaveBeenCalledExactlyOnceWith(fixture.workspace);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
