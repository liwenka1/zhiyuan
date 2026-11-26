import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";

const DISPLAY = 1;
const REGISTRY = 2;
const DATA_CONTROL = ["ext_data_control_manager_v1", "zwlr_data_control_manager_v1"];

export interface WaylandClipboard {
  revision(): number | undefined;
  sync(): Promise<number | undefined>;
}

function words(...values: number[]): Buffer {
  const bytes = Buffer.alloc(values.length * 4);
  for (const [index, value] of values.entries()) bytes.writeUInt32LE(value, index * 4);
  return bytes;
}

function wireString(value: string): Buffer {
  const length = Buffer.byteLength(value) + 1;
  const bytes = Buffer.alloc(4 + Math.ceil(length / 4) * 4);
  bytes.writeUInt32LE(length);
  bytes.write(value, 4);
  return bytes;
}

export async function openWaylandClipboard(): Promise<WaylandClipboard | undefined> {
  // libwayland unsets WAYLAND_SOCKET when it consumes an inherited connection.
  // Check the startup environment before opening a separate connection by name.
  if (process.env.WAYLAND_SOCKET !== undefined) return;
  try {
    const environment = await readFile("/proc/self/environ", "utf8");
    if (environment.split("\0").some((variable) => variable.startsWith("WAYLAND_SOCKET="))) return;
  } catch {
    return;
  }
  const display = process.env.WAYLAND_DISPLAY ?? "wayland-0";
  if (!display) return;
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (!path.isAbsolute(display) && !runtimeDir) return;
  return connectWaylandClipboard(path.isAbsolute(display) ? display : `${runtimeDir}/${display}`);
}

/** Observe offered selections without requesting their MIME payloads. */
async function connectWaylandClipboard(socketPath: string): Promise<WaylandClipboard | undefined> {
  const socket = createConnection(socketPath);
  socket.unref();
  const globals = new Map<number, string>();
  const callbacks = new Map<number, (revision?: number) => void>();
  const devices = new Map<number, { clipboard?: number; primary?: number }>();
  let nextId = REGISTRY + 1;
  let revision = 0;
  let active = false;
  let unread: Buffer = Buffer.alloc(0);

  function close() {
    active = false;
    socket.destroy();
    for (const done of callbacks.values()) done();
    callbacks.clear();
  }

  function send(id: number, opcode: number, args: Buffer = Buffer.alloc(0)) {
    const header = words(id, ((args.length + 8) << 16) | opcode);
    socket.write(Buffer.concat([header, args]));
  }

  function roundTrip(): Promise<number | undefined> {
    if (socket.destroyed) return Promise.resolve(undefined);
    const id = nextId++;
    return new Promise((resolve) => {
      const timeout = setTimeout(close, 1000);
      callbacks.set(id, (snapshot) => {
        clearTimeout(timeout);
        callbacks.delete(id);
        resolve(snapshot);
      });
      send(DISPLAY, 0, words(id));
    });
  }

  function receive(id: number, opcode: number, args: Buffer) {
    if (id === DISPLAY && opcode === 0) close();
    if (id === REGISTRY && opcode === 0) {
      const name = args.readUInt32LE(0);
      const length = args.readUInt32LE(4);
      const type = args.toString("utf8", 8, 7 + length);
      globals.set(name, type);
      // A new seat changes which selections need to be tracked.
      if (active && type === "wl_seat") close();
    }
    if (id === REGISTRY && opcode === 1) {
      const name = args.readUInt32LE(0);
      if (active && globals.get(name) === "wl_seat") close();
      globals.delete(name);
    }
    if (opcode === 0) callbacks.get(id)?.(revision);
    const device = devices.get(id);
    if (!device) return;
    if (opcode === 2) close(); // The compositor finished this data-control device.
    if (opcode === 1 || opcode === 3) {
      const selection = opcode === 1 ? "clipboard" : "primary";
      const offer = args.readUInt32LE(0);
      const previous = device[selection];
      if (previous && previous !== offer) send(previous, 1); // destroy the expired offer
      device[selection] = offer;
      if (selection === "clipboard") revision += 1;
    }
  }

  socket.on("error", close);
  socket.on("close", close);
  socket.on("data", (chunk: Buffer) => {
    unread = unread.length ? Buffer.concat([unread, chunk]) : chunk;
    try {
      while (unread.length >= 8 && !socket.destroyed) {
        const length = unread.readUInt16LE(6);
        if (length < 8 || length % 4) {
          close();
          return;
        }
        if (unread.length < length) return;
        receive(unread.readUInt32LE(), unread.readUInt16LE(4), unread.subarray(8, length));
        unread = unread.subarray(length);
      }
    } catch {
      close();
    }
  });

  function bind(name: number, type: string): number {
    const id = nextId++;
    send(REGISTRY, 0, Buffer.concat([words(name), wireString(type), words(1, id)]));
    return id;
  }

  send(DISPLAY, 1, words(REGISTRY));
  if ((await roundTrip()) === undefined) return;
  const managerType = DATA_CONTROL.find((type) => [...globals.values()].includes(type));
  const manager = [...globals].find(([, type]) => type === managerType);
  const seats = [...globals].filter(([, type]) => type === "wl_seat");
  if (!manager || !seats.length) {
    close();
    return;
  }
  // Monitor the seat list while binding devices as well as after the initial round trip.
  active = true;
  const managerId = bind(...manager);
  for (const seat of seats) {
    const seatId = bind(...seat);
    const deviceId = nextId++;
    devices.set(deviceId, {});
    send(managerId, 1, words(deviceId, seatId));
  }
  if ((await roundTrip()) === undefined || !active) return;
  // Each device sends an initial selection, including a null selection for an empty clipboard.
  if ([...devices.values()].some((device) => device.clipboard === undefined)) {
    close();
    return;
  }
  return {
    revision: () => (active ? revision : undefined),
    async sync() {
      if (!active) return;
      const snapshot = await roundTrip();
      return active ? snapshot : undefined;
    }
  };
}
