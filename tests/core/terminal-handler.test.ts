import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { IpcResultDTO } from "../../apps/desktop/src/shared";

type Handler = (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => IpcResultDTO<unknown>;
const { handlers, spawn } = vi.hoisted(() => ({ handlers: new Map<string, Handler>(), spawn: vi.fn() }));
vi.mock("../../apps/desktop/src/main/security/app-ipc", () => ({
  handleAppIpc: (channel: string, handler: Handler) => handlers.set(channel, handler)
}));
vi.mock("../../apps/desktop/src/main/security/window-context", () => ({
  getCallerWorkspace: () => "/test-workspace"
}));
vi.mock("electron", () => ({ app: { getLocale: () => "en-US" } }));
vi.mock("node-pty", () => ({ spawn }));

import { registerTerminalHandlers } from "../../apps/desktop/src/main/ipc/terminal-handler";

class Sender extends EventEmitter {
  send = vi.fn();
  isDestroyed() {
    return false;
  }
  invoke(channel: string, ...args: unknown[]) {
    return handlers.get(`terminal:${channel}`)!({ sender: this } as unknown as Electron.IpcMainInvokeEvent, ...args);
  }
}

function createShell() {
  const emitter = new EventEmitter();
  const subscribe = (event: string, listener: (...args: any[]) => void) => {
    emitter.on(event, listener);
    return { dispose: () => emitter.off(event, listener) };
  };
  const pty = {
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    onData: (listener: (data: string) => void) => {
      listener("startup output");
      return subscribe("data", listener);
    },
    onExit: (listener: (event: { exitCode: number }) => void) => subscribe("exit", listener)
  };
  spawn.mockReturnValueOnce(pty);
  return { pty, emitter };
}

beforeAll(registerTerminalHandlers);

describe("terminal session lifetime", () => {
  it("delivers initial output with the known ID, then releases a naturally exited shell", () => {
    const sender = new Sender();
    const { pty, emitter } = createShell();
    const id = randomUUID();
    expect(sender.invoke("create", id).ok).toBe(true);
    expect(sender.send).toHaveBeenCalledWith("terminal:data", { id, data: "startup output" });
    expect(spawn).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        cwd: "/test-workspace"
      })
    );

    emitter.emit("exit", { exitCode: 0 });
    expect(sender.send).toHaveBeenLastCalledWith("terminal:exit", { id, exitCode: 0, signal: undefined });
    expect(pty.kill).not.toHaveBeenCalled();
    expect(emitter.eventNames()).toEqual([]);
    expect(sender.eventNames()).toEqual([]);
    expect(sender.invoke("input", id, "ignored").ok).toBe(false);
  });

  it("shares lifecycle listeners and removes them when repeated tabs are explicitly closed", () => {
    const sender = new Sender();
    const first = createShell();
    const firstId = randomUUID();
    sender.invoke("create", firstId);

    for (let i = 0; i < 12; i++) {
      const next = createShell();
      const id = randomUUID();
      sender.invoke("create", id);
      expect(sender.listenerCount("destroyed")).toBe(1);
      expect(sender.invoke("dispose", id).ok).toBe(true);
      expect(next.pty.kill).toHaveBeenCalledOnce();
      expect(next.emitter.eventNames()).toEqual([]);
    }

    sender.invoke("dispose", firstId);
    expect(first.pty.kill).toHaveBeenCalledOnce();
    expect(sender.eventNames()).toEqual([]);
  });

  it("keeps the shell alive when a navigation is canceled or stays in the same document", () => {
    const sender = new Sender();
    const { pty } = createShell();
    const id = randomUUID();
    sender.invoke("create", id);

    sender.emit("did-start-navigation", { isMainFrame: true, isSameDocument: false });
    sender.emit("did-frame-navigate", {}, "about:blank", -1, "", false);
    sender.emit("did-navigate-in-page", { isMainFrame: true });
    expect(sender.invoke("input", id, "still attached").ok).toBe(true);
    expect(pty.write).toHaveBeenCalledWith("still attached");
    expect(pty.kill).not.toHaveBeenCalled();
    sender.invoke("dispose", id);
  });

  it.each(["destroyed", "render-process-gone", "did-navigate"])(
    "releases all of the sender's terminals on %s",
    (event) => {
      const sender = new Sender();
      const first = createShell();
      const second = createShell();
      const firstId = randomUUID();
      sender.invoke("create", firstId);
      sender.invoke("create", randomUUID());

      sender.emit(event);

      expect(first.pty.kill).toHaveBeenCalledOnce();
      expect(second.pty.kill).toHaveBeenCalledOnce();
      expect(sender.eventNames()).toEqual([]);
      expect(sender.invoke("resize", firstId, 80, 24).ok).toBe(false);
    }
  );
});
