import { EventEmitter } from "node:events";
import type { IpcRenderer } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    ipcRenderer: Object.assign(new EventEmitter(), { invoke: vi.fn() }),
    webUtils: { getPathForFile: (file: { sourcePath: string }) => file.sourcePath }
  };
});

describe("external opening across preload and renderer startup", () => {
  let ipcRenderer: IpcRenderer;
  let workspaceApi: typeof import("../../apps/desktop/src/preload/apis/workspace").workspaceApi;
  const first = { workspacePath: "/workspace", filePath: "/workspace/first.md" };
  const second = { workspacePath: "/workspace", filePath: "/workspace/second.md" };
  const third = { workspacePath: "/workspace", filePath: "/workspace/third.md" };

  function send(payload: typeof first) {
    ipcRenderer.emit("workspace:external-open", {}, payload);
  }

  beforeEach(async () => {
    vi.resetModules();
    ipcRenderer = (await import("electron")).ipcRenderer;
    ipcRenderer.removeAllListeners();
    workspaceApi = (await import("../../apps/desktop/src/preload/apis/workspace")).workspaceApi;
  });

  it("listens before page load and delivers a startup file to a late renderer subscription", () => {
    expect(ipcRenderer.listenerCount("workspace:external-open")).toBe(1);
    const webContents = new EventEmitter();
    webContents.once("did-finish-load", () => send(first));
    webContents.emit("did-finish-load");
    const callback = vi.fn();

    workspaceApi.onExternalOpen(callback);

    expect(callback).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("consumes multiple early targets in order without replaying them to a later subscriber", () => {
    send(first);
    send(second);
    const callback = vi.fn();
    workspaceApi.onExternalOpen(callback);
    const later = vi.fn();
    workspaceApi.onExternalOpen(later);

    expect(callback.mock.calls).toEqual([[first], [second]]);
    expect(later).not.toHaveBeenCalled();
    send(third);
    expect(callback.mock.calls).toEqual([[first], [second], [third]]);
    expect(later).toHaveBeenCalledExactlyOnceWith(third);
  });

  it("buffers new events between subscriptions but does not replay consumed events", () => {
    const callback = vi.fn();
    const unsubscribe = workspaceApi.onExternalOpen(callback);
    send(first);
    unsubscribe();
    unsubscribe();
    send(second);

    const unsubscribeAgain = workspaceApi.onExternalOpen(callback);
    expect(callback.mock.calls).toEqual([[first], [second]]);
    unsubscribeAgain();
    const later = vi.fn();
    workspaceApi.onExternalOpen(later);
    expect(later).not.toHaveBeenCalled();
    expect(ipcRenderer.listenerCount("workspace:external-open")).toBe(1);
  });

  it("keeps each subscription independent when callbacks share the same identity", () => {
    const callback = vi.fn();
    const unsubscribeFirst = workspaceApi.onExternalOpen(callback);
    const unsubscribeSecond = workspaceApi.onExternalOpen(callback);
    send(first);
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    send(second);
    expect(callback.mock.calls).toEqual([[first], [first], [second]]);
    unsubscribeSecond();
    send(third);
    expect(callback).toHaveBeenCalledTimes(3);
    workspaceApi.onExternalOpen(callback);
    expect(callback.mock.calls).toEqual([[first], [first], [second], [third]]);
  });

  it("finishes delivering an event before delivering one triggered by a callback", () => {
    const delivered: string[] = [];
    workspaceApi.onExternalOpen((payload) => {
      delivered.push(`a:${payload.filePath}`);
      if (payload === first) send(second);
    });
    workspaceApi.onExternalOpen((payload) => delivered.push(`b:${payload.filePath}`));

    send(first);

    expect(delivered).toEqual([
      `a:${first.filePath}`,
      `b:${first.filePath}`,
      `a:${second.filePath}`,
      `b:${second.filePath}`
    ]);
  });

  it("propagates callback errors without leaving later delivery locked", () => {
    const failure = new Error("renderer handler failed");
    const callback = vi.fn().mockImplementationOnce(() => {
      throw failure;
    });
    workspaceApi.onExternalOpen(callback);

    expect(() => send(first)).toThrow(failure);
    send(second);

    expect(callback.mock.calls).toEqual([[first], [second]]);
  });
});

describe("native Markdown drop grants in preload", () => {
  it("only forwards paths from a current trusted drop and consumes them once", async () => {
    const { ipcRenderer } = await import("electron");
    const { observeNativeMarkdownDrops, workspaceApi } = await import("../../apps/desktop/src/preload/apis/workspace");
    const invoke = vi.mocked(ipcRenderer.invoke);
    invoke.mockReset().mockResolvedValue({ ok: true });
    const target = { addEventListener: vi.fn() };
    observeNativeMarkdownDrops(target as unknown as Window);
    const nativeDrop = target.addEventListener.mock.lastCall?.[1];
    const file = { name: "native.MD", sourcePath: "/dropped/native.MD" };
    const otherPath = "/elsewhere/other.md";
    const drop = (isTrusted: boolean) => nativeDrop({ isTrusted, dataTransfer: { files: [file] } });

    drop(false);
    expect(await workspaceApi.approveDroppedFile(file.sourcePath)).toMatchObject({ ok: false });
    drop(true);
    expect(await workspaceApi.importMarkdownFiles([file.sourcePath, otherPath], "/workspace")).toMatchObject({
      ok: false
    });
    expect(await workspaceApi.importMarkdownFiles([file.sourcePath], "/workspace")).toMatchObject({ ok: true });
    expect(await workspaceApi.approveDroppedFile(file.sourcePath)).toMatchObject({ ok: false });
    expect(invoke).toHaveBeenCalledExactlyOnceWith("workspace:importMarkdownFiles", [file.sourcePath], "/workspace");
  });
});
