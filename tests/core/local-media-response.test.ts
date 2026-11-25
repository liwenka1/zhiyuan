import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalMediaResponse } from "../../apps/desktop/src/main/security/local-media-response";

describe("local media responses", () => {
  let root: string;
  let filePath: string;
  const data = "0123456789";

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "zhiyuan-media-range-"));
    filePath = path.join(root, "media.mp4");
    await writeFile(filePath, data);
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  function request(range?: string, method = "GET") {
    return createLocalMediaResponse(
      new Request("local-media://file/media", {
        method,
        headers: range === undefined ? undefined : { range }
      }),
      { filePath }
    );
  }

  it.each([
    ["bytes=2-5", "bytes 2-5/10", "2345"],
    ["bytes=7-", "bytes 7-9/10", "789"],
    ["bytes=8-500", "bytes 8-9/10", "89"],
    ["bytes=-3", "bytes 7-9/10", "789"]
  ])("streams the requested bytes for %s", async (range, expectedHeader, expectedBody) => {
    const response = await request(range);
    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe(expectedHeader);
    expect(response.headers.get("content-length")).toBe(String(expectedBody.length));
    expect(await response.text()).toBe(expectedBody);
  });

  it.each(["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=invalid"])(
    "reports an unsatisfiable range for %s",
    async (range) => {
      const response = await request(range);
      expect(response.status).toBe(416);
      expect(response.headers.get("content-range")).toBe("bytes */10");
      expect(response.body).toBeNull();
    }
  );

  it("sends normal GET and HEAD metadata with the full length", async () => {
    const full = await request();
    const head = await request("bytes=2-3", "HEAD");
    for (const response of [full, head]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-length")).toBe("10");
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(response.headers.get("content-range")).toBeNull();
    }
    expect(await full.text()).toBe(data);
    expect(head.body).toBeNull();
  });
});
