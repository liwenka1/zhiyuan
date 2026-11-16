import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock("node:http", () => ({ request: requestMock }));

import { assertSafeRemoteHttpUrl, fetchSafeRemoteHttp } from "../../apps/desktop/src/main/security/remote-url";

let respond!: (incoming: IncomingMessage) => void;

function incomingResponse(status: number, content = ""): IncomingMessage {
  return Object.assign(Readable.from(content ? [Buffer.from(content)] : []), {
    statusCode: status,
    statusMessage: "",
    headers: {}
  }) as IncomingMessage;
}

describe("safe remote HTTP response handling", () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockImplementation((_options, callback) => {
      respond = callback;
      return Object.assign(new EventEmitter(), {
        end: vi.fn(),
        setTimeout: vi.fn(),
        destroy: vi.fn()
      });
    });
  });

  it.each(["http://[fc00::1]/", "http://[fd00::1]/", "http://[fd12:3456:789a::1]/"])(
    "rejects private ULA target %s",
    async (url) => {
      await expect(assertSafeRemoteHttpUrl(url)).rejects.toThrow("Private network URLs");
      expect(requestMock).not.toHaveBeenCalled();
    }
  );

  it.each([204, 205, 304])("returns status %s without throwing out of the response callback", async (status) => {
    const pending = fetchSafeRemoteHttp("http://1.1.1.1/resource");
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    const incoming = incomingResponse(status);
    const resumeSpy = vi.spyOn(incoming, "resume");

    expect(() => respond(incoming)).not.toThrow();
    const { response } = await pending;

    expect(response.status).toBe(status);
    expect(response.body).toBeNull();
    expect(await response.text()).toBe("");
    expect(resumeSpy).toHaveBeenCalled();
  });

  it("streams a normal body while connecting to the validated IP address", async () => {
    const pending = fetchSafeRemoteHttp("http://1.1.1.1/article");
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    respond(incomingResponse(200, "article body"));
    const { response } = await pending;

    expect(requestMock.mock.calls[0][0]).toMatchObject({ hostname: "1.1.1.1", headers: { host: "1.1.1.1" } });
    expect(await response.text()).toBe("article body");
  });

  it("rejects malformed responses through the promise instead of throwing from the callback", async () => {
    const pending = fetchSafeRemoteHttp("http://1.1.1.1/malformed");
    const outcome = pending.then(
      () => null,
      (error: unknown) => error
    );
    await vi.waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    const incoming = incomingResponse(199);

    expect(() => respond(incoming)).not.toThrow();
    expect(await outcome).toBeInstanceOf(Error);
    expect(incoming.destroyed).toBe(true);
  });
});
