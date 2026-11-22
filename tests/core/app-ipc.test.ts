import { describe, expect, it, vi } from "vitest";
import { RENDERER_URL, trustedIpcEvent } from "./helpers/trusted-ipc-event";

const { ipcHandle, ipcOn, getEntry } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  ipcOn: vi.fn(),
  getEntry: vi.fn()
}));
vi.mock("electron", () => ({ ipcMain: { handle: ipcHandle, on: ipcOn } }));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({
  windowManager: { getEntryByWebContents: getEntry }
}));

import { handleAppIpc, onAppIpc } from "../../apps/desktop/src/main/security/app-ipc";
import { ipcOk } from "../../apps/desktop/src/main/ipc/ipc-result";

describe("application IPC sender validation", () => {
  it("allows the registered window's own document in its main frame", () => {
    const event = trustedIpcEvent({});
    event.senderFrame.url = `${RENDERER_URL}#heading`;
    getEntry.mockReturnValue({ rendererUrl: RENDERER_URL });
    const handler = vi.fn(() => ipcOk(42));
    handleAppIpc("test:invoke", handler);

    expect(ipcHandle.mock.lastCall?.[1](event)).toEqual(ipcOk(42));
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
    expect(getEntry).toHaveBeenLastCalledWith(event.sender);
  });

  it("rejects senders from another document, a child frame, or an unmanaged window", () => {
    const event = trustedIpcEvent({});
    getEntry.mockReturnValue({ rendererUrl: RENDERER_URL });
    const handler = vi.fn(() => ipcOk(undefined));
    handleAppIpc("test:invoke", handler);
    const invoke = ipcHandle.mock.lastCall?.[1];

    event.senderFrame.url = "file:///application/renderer/other.html";
    expect(invoke(event).error.code).toBe("IPC_SENDER_UNAUTHORIZED");
    event.senderFrame.url = RENDERER_URL;
    expect(invoke({ ...event, senderFrame: { url: RENDERER_URL } }).error.code).toBe("IPC_SENDER_UNAUTHORIZED");
    getEntry.mockReturnValue(undefined);
    expect(invoke(event).error.code).toBe("IPC_SENDER_UNAUTHORIZED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("filters fire-and-forget events through the same sender check", () => {
    const event = trustedIpcEvent({});
    getEntry.mockReturnValue({ rendererUrl: RENDERER_URL });
    const listener = vi.fn();
    onAppIpc("test:send", listener);
    const send = ipcOn.mock.lastCall?.[1];

    send({ ...event, senderFrame: null });
    send(event, "message");
    expect(listener).toHaveBeenCalledExactlyOnceWith(event, "message");
  });
});
