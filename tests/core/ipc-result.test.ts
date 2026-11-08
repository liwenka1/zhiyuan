import { describe, expect, it } from "vitest";
import { ipcErr, ipcOk, wrapIpcHandler, wrapIpcHandlerWithEvent } from "../../apps/desktop/src/main/ipc/ipc-result";

describe("IPC result contract", () => {
  it("returns a JSON-safe success DTO", () => {
    expect(ipcOk({ count: 2 })).toEqual({ ok: true, value: { count: 2 } });
  });

  it("returns a stable error DTO without leaking error objects", () => {
    expect(ipcErr("Permission denied", "FILE_WRITE_FAILED", new Error("secret path"))).toEqual({
      ok: false,
      error: { message: "Permission denied", code: "FILE_WRITE_FAILED" }
    });
  });

  it("wraps successful and failed async handlers", async () => {
    const success = wrapIpcHandler(async (value: number) => value * 2);
    const failure = wrapIpcHandler(async () => {
      throw new Error("boom");
    }, "TEST_FAILED");

    await expect(success({} as never, 3)).resolves.toEqual({ ok: true, value: 6 });
    await expect(failure({} as never)).resolves.toEqual({
      ok: false,
      error: { message: "boom", code: "TEST_FAILED" }
    });
  });

  it("passes the IPC event to event-aware handlers", async () => {
    const event = { sender: { id: 42 } } as never;
    const handler = wrapIpcHandlerWithEvent(async (receivedEvent, value: string) => ({
      senderId: receivedEvent.sender.id,
      value
    }));

    await expect(handler(event, "ok")).resolves.toEqual({
      ok: true,
      value: { senderId: 42, value: "ok" }
    });
  });
});
