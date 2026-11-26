import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openWaylandClipboard } from "../../apps/desktop/src/main/export/wayland-clipboard";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: vi.fn()
}));
vi.mock("node:net", async (importOriginal) => {
  const net = await importOriginal<typeof import("node:net")>();
  return { ...net, createConnection: vi.fn(net.createConnection) };
});

beforeEach(() => {
  vi.stubEnv("WAYLAND_SOCKET", undefined);
  vi.stubEnv("XDG_RUNTIME_DIR", os.tmpdir());
  vi.stubEnv("WAYLAND_DISPLAY", "another-compositor");
  vi.mocked(readFile).mockReset().mockResolvedValue("WAYLAND_DISPLAY=another-compositor\0");
  vi.mocked(createConnection).mockClear();
});

afterEach(() => vi.unstubAllEnvs());

it.each(["current environment", "startup environment", "unreadable startup environment"])(
  "does not connect to the named compositor when the inherited connection cannot be ruled out (%s)",
  async (source) => {
    if (source === "current environment") vi.stubEnv("WAYLAND_SOCKET", "9");
    if (source === "startup environment") {
      vi.mocked(readFile).mockResolvedValue("WAYLAND_DISPLAY=another-compositor\0WAYLAND_SOCKET=9\0");
    }
    if (source === "unreadable startup environment") vi.mocked(readFile).mockRejectedValue(new Error("unavailable"));

    expect(await openWaylandClipboard()).toBeUndefined();
    expect(createConnection).not.toHaveBeenCalled();
  }
);

function words(...values: number[]): Buffer {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeUInt32LE(value, index * 4));
  return bytes;
}

function packet(id: number, opcode: number, args: Buffer): Buffer {
  return Buffer.concat([words(id, ((args.length + 8) << 16) | opcode), args]);
}

function global(name: number, type: string): Buffer {
  const string = Buffer.alloc(Math.ceil((type.length + 1) / 4) * 4);
  string.write(type);
  return packet(2, 0, Buffer.concat([words(name, type.length + 1), string, words(1)]));
}

it.each([
  "stable seats",
  "empty clipboard",
  "seat added during setup",
  "seat removed during setup",
  "missing initial selection"
] as const)("establishes a complete Wayland clipboard monitor with %s", async (scenario) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wl-test-"));
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\${path.basename(dir)}` : path.join(dir, "s");
  let peer: Socket | undefined;
  let device: number;
  let updates: Buffer[] = [];
  let afterSync: Buffer[] = [];
  const requests: Array<{ id: number; opcode: number }> = [];
  const server = createServer((connection) => {
    peer = connection;
    let bytes: Buffer = Buffer.alloc(0);
    connection.on("data", (chunk: Buffer) => {
      bytes = Buffer.concat([bytes, chunk]);
      while (bytes.length >= 8 && bytes.length >= bytes.readUInt16LE(6)) {
        const id = bytes.readUInt32LE(0);
        const opcode = bytes.readUInt16LE(4);
        const length = bytes.readUInt16LE(6);
        const args = bytes.subarray(8, length);
        bytes = bytes.subarray(length);
        requests.push({ id, opcode });
        if (id === 1 && opcode === 1) {
          const announcement = global(10, "ext_data_control_manager_v1");
          connection.write(announcement.subarray(0, 7));
          connection.write(Buffer.concat([announcement.subarray(7), global(11, "wl_seat")]));
        } else if (id === 1 && opcode === 0) {
          const callback = args.readUInt32LE(0);
          connection.write(Buffer.concat([...updates, packet(callback, 0, words(0)), ...afterSync]));
          updates = [];
          afterSync = [];
        } else if (id === 4 && opcode === 1) {
          device = args.readUInt32LE(0);
          if (scenario !== "missing initial selection") {
            const offer = scenario === "empty clipboard" ? 0 : 0xff000001;
            updates.push(packet(device, 1, words(offer)));
          }
          if (scenario === "seat added during setup") updates.push(global(12, "wl_seat"));
          if (scenario === "seat removed during setup") updates.push(packet(2, 1, words(11)));
        }
      }
    });
  });
  server.listen(socketPath);
  try {
    await once(server, "listening");
    vi.stubEnv("WAYLAND_DISPLAY", socketPath);
    const monitor = await openWaylandClipboard();
    expect(readFile).toHaveBeenCalledExactlyOnceWith("/proc/self/environ", "utf8");
    if (scenario === "empty clipboard") {
      expect(await monitor?.sync()).toBe(1);
      return;
    }
    if (scenario !== "stable seats") {
      expect(monitor).toBeUndefined();
      return;
    }
    expect(monitor?.revision()).toBe(1);
    expect(await monitor?.sync()).toBe(1);

    updates = [packet(device!, 1, words(0xff000002)), packet(device!, 1, words(0xff000003))];
    expect(monitor?.revision()).toBe(1);
    expect(await monitor?.sync()).toBe(3);

    updates = [packet(device!, 1, words(0xff000004))];
    afterSync = [packet(device!, 1, words(0xff000005))];
    expect(await monitor?.sync()).toBe(4);
    expect(await monitor?.sync()).toBe(5);

    updates = [packet(device!, 3, words(0xff000006))];
    expect(await monitor?.sync()).toBe(5);
    expect(requests).toContainEqual({ id: 0xff000001, opcode: 1 });
    expect(requests).toContainEqual({ id: 0xff000002, opcode: 1 });
    expect(requests.some(({ id, opcode }) => id >= 0xff000000 && opcode === 0)).toBe(false);

    updates = [packet(device!, 2, Buffer.alloc(0))];
    expect(await monitor?.sync()).toBeUndefined();
    expect(monitor?.revision()).toBeUndefined();
  } finally {
    peer?.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
