import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";
import { RENDERER_URL, trustedIpcEvent } from "./helpers/trusted-ipc-event";

type Handler = (
  event: Electron.IpcMainInvokeEvent,
  expectedPath?: unknown
) => IpcResultDTO<void> | Promise<IpcResultDTO<void>>;

const { handlers, pauseMock, resumeMock, callerState, pauseCounts, invokeMock } = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  pauseMock: vi.fn(),
  resumeMock: vi.fn(),
  invokeMock: vi.fn(),
  callerState: { workspacePath: "/workspace-a" as string | null },
  pauseCounts: new Map<string, number>()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler)
  },
  ipcRenderer: { invoke: invokeMock },
  BrowserWindow: { fromWebContents: () => ({ id: 7 }) }
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { getEntryByWebContents: () => ({ ...callerState, rendererUrl: RENDERER_URL }) }
}));
vi.mock("../../apps/desktop/src/main/file-watcher", () => ({
  fileWatcherManager: { pauseWatching: pauseMock, resumeWatching: resumeMock }
}));

beforeAll(async () => {
  const { registerWatcherHandlers } = await import("../../apps/desktop/src/main/ipc/watcher-handler");
  registerWatcherHandlers();
});

function call(channel: string, expectedPath?: unknown) {
  return handlers.get(channel)!(trustedIpcEvent({}) as unknown as Electron.IpcMainInvokeEvent, expectedPath);
}

describe("workspace-scoped watcher IPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerState.workspacePath = "/workspace-a";
    pauseCounts.clear();
    pauseMock.mockImplementation((workspacePath: string, windowId: number) => {
      const key = `${windowId}:${workspacePath}`;
      pauseCounts.set(key, (pauseCounts.get(key) ?? 0) + 1);
    });
    resumeMock.mockImplementation((workspacePath: string, windowId: number) => {
      const key = `${windowId}:${workspacePath}`;
      pauseCounts.set(key, Math.max(0, (pauseCounts.get(key) ?? 0) - 1));
    });
  });

  it("does not let workspace A cleanup resume workspace B's watcher", async () => {
    expect((await call("watcher:pause", "/workspace-a")).ok).toBe(true);
    callerState.workspacePath = "/workspace-b";
    expect((await call("watcher:pause", "/workspace-b")).ok).toBe(true);

    expect((await call("watcher:resume", "/workspace-a")).ok).toBe(true);

    expect(resumeMock).toHaveBeenCalledWith("/workspace-a", 7);
    expect(pauseCounts.get("7:/workspace-b")).toBe(1);
  });

  it("rejects a stale pause request after switching workspaces", async () => {
    callerState.workspacePath = "/workspace-b";

    expect((await call("watcher:pause", "/workspace-a")).ok).toBe(false);
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("keeps no-argument callers scoped to the current workspace", async () => {
    expect((await call("watcher:pause")).ok).toBe(true);
    expect((await call("watcher:resume")).ok).toBe(true);

    expect(pauseMock).toHaveBeenCalledWith("/workspace-a", 7);
    expect(resumeMock).toHaveBeenCalledWith("/workspace-a", 7);
  });

  it("accepts equivalent normalized paths", async () => {
    expect((await call("watcher:pause", "/workspace-a/.")).ok).toBe(true);
    expect(pauseMock).toHaveBeenCalledWith("/workspace-a", 7);
  });

  it("passes the captured workspace through the preload bridge", async () => {
    const { watcherApi } = await import("../../apps/desktop/src/preload/apis/watcher");
    invokeMock.mockResolvedValue({ ok: true, value: undefined });

    await watcherApi.pause("/workspace-a");
    await watcherApi.resume("/workspace-a");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "watcher:pause", "/workspace-a");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "watcher:resume", "/workspace-a");
  });

  it.each(["", 12, null])("rejects invalid workspace context %s", async (expectedPath) => {
    expect((await call("watcher:pause", expectedPath)).ok).toBe(false);
    expect((await call("watcher:resume", expectedPath)).ok).toBe(false);
    expect(pauseMock).not.toHaveBeenCalled();
    expect(resumeMock).not.toHaveBeenCalled();
  });
});
