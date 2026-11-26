import { afterEach, beforeEach, expect, it, vi } from "vitest";

const {
  getSwitchValue,
  openWaylandClipboard,
  openDisplay,
  closeDisplay,
  queryX11Extension,
  checkEvent,
  checkNativeAccess,
  readFormats,
  readText
} = vi.hoisted(() => ({
  getSwitchValue: vi.fn<(name: string) => string>(),
  openWaylandClipboard: vi.fn(),
  openDisplay: vi.fn<(display: string | null) => number>(),
  closeDisplay: vi.fn<(display: number) => number>(),
  queryX11Extension: vi.fn<(display: number, name: string) => number>(),
  checkEvent: vi.fn<() => number>(),
  checkNativeAccess: vi.fn(),
  readFormats: vi.fn(() => {
    throw new Error("The previous selection owner is unresponsive");
  }),
  readText: vi.fn()
}));

vi.mock("electron", () => ({
  app: { commandLine: { getSwitchValue } },
  clipboard: { availableFormats: readFormats, readText }
}));
vi.mock("../../apps/desktop/src/main/export/wayland-clipboard", () => ({ openWaylandClipboard }));
vi.mock("../../apps/desktop/src/main/native/koffi", () => ({
  loadPackagedKoffi: () => {
    checkNativeAccess();
    return {
      sizeof: () => 8,
      load: () => ({
        func(name: string) {
          if (name === "XOpenDisplay") return openDisplay;
          if (name === "XCloseDisplay") return closeDisplay;
          if (name === "XQueryExtension") return queryX11Extension;
          if (name === "XCheckTypedEvent") return checkEvent;
          if (name === "XFixesQueryVersion") {
            return (_display: number, major: Buffer) => {
              major.writeInt32LE(1);
              return 1;
            };
          }
          return () => 1;
        }
      })
    };
  }
}));

const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
let clipboardState: typeof import("../../apps/desktop/src/main/export/clipboard-state");

beforeEach(async () => {
  vi.resetModules();
  Object.defineProperty(process, "platform", { ...descriptor, value: "linux" });
  vi.stubEnv("XDG_SESSION_TYPE", undefined);
  vi.stubEnv("WAYLAND_DISPLAY", undefined);
  vi.stubEnv("WAYLAND_SOCKET", undefined);
  getSwitchValue.mockReset().mockImplementation((name) => (name === "ozone-platform" ? "wayland" : ""));
  openWaylandClipboard.mockReset().mockResolvedValue(undefined);
  openDisplay.mockReset().mockReturnValue(1);
  closeDisplay.mockReset().mockReturnValue(0);
  queryX11Extension.mockReset().mockReturnValue(0);
  checkEvent.mockReset().mockReturnValue(0);
  checkNativeAccess.mockReset();
  readFormats.mockClear();
  readText.mockClear();
  clipboardState = await import("../../apps/desktop/src/main/export/clipboard-state");
});

afterEach(() => {
  Object.defineProperty(process, "platform", descriptor);
  vi.unstubAllEnvs();
});

it.each([false, true])(
  "allows Wayland confirmation without reading older clipboard contents (monitor failed=%s)",
  async (failedMonitor) => {
    if (failedMonitor) openWaylandClipboard.mockResolvedValue({ sync: vi.fn().mockResolvedValue(undefined) });
    clipboardState.initializeClipboardMonitor();
    await Promise.resolve();

    const request = await clipboardState.watchClipboard();
    expect(request.needsConfirmation).toBe(true);
    expect(request.needsWindowFocus).toBe(true);
    expect(await request.unchanged()).toBe(true);
    expect(readFormats).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  }
);

it.each(["darwin", "win32"] as const)(
  "uses confirmation on %s when the native clipboard counter is unavailable",
  async (platform) => {
    Object.defineProperty(process, "platform", { ...descriptor, value: platform });
    checkNativeAccess.mockImplementationOnce(() => {
      throw new Error("Native clipboard counter unavailable");
    });
    clipboardState.initializeClipboardMonitor();
    const request = await clipboardState.watchClipboard();

    expect(request.needsConfirmation).toBe(true);
    expect(request.needsWindowFocus).toBe(false);
    expect(await request.unchanged()).toBe(true);
    expect(readFormats).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  }
);

it("synchronizes pending Wayland notifications before taking the baseline", async () => {
  const revision = vi.fn().mockReturnValue(2);
  const sync = vi.fn().mockResolvedValue(4);
  sync.mockImplementationOnce(async () => {
    revision.mockReturnValue(4);
    return 4;
  });
  openWaylandClipboard.mockResolvedValue({ revision, sync });
  clipboardState.initializeClipboardMonitor();
  await Promise.resolve();

  const request = await clipboardState.watchClipboard();
  expect(sync).toHaveBeenCalledTimes(1);
  expect(request.needsConfirmation).toBe(false);
  expect(request.needsWindowFocus).toBe(true);
  expect(await request.unchanged()).toBe(true);

  // A newer offer may arrive in the same read, after the sync callback.
  revision.mockReturnValue(5);
  expect(await request.unchanged()).toBe(false);
});

it.each([
  ["XDG_SESSION_TYPE", "wayland"],
  ["WAYLAND_DISPLAY", "wayland-0"],
  ["WAYLAND_SOCKET", "9"]
] as const)("requires confirmation for an X11 backend with %s", async (variable, value) => {
  vi.stubEnv("DISPLAY", ":1");
  vi.stubEnv(variable, value);
  getSwitchValue.mockImplementation((name) => (name === "ozone-platform" ? "x11" : ""));
  clipboardState.initializeClipboardMonitor();

  const request = await clipboardState.watchClipboard();
  expect(request.needsConfirmation).toBe(true);
  expect(request.needsWindowFocus).toBe(true);
  expect(openDisplay).not.toHaveBeenCalled();
  expect(openWaylandClipboard).not.toHaveBeenCalled();
});

it("identifies an XWayland server on the actual display when Wayland session variables are absent", async () => {
  vi.stubEnv("DISPLAY", ":1");
  getSwitchValue.mockImplementation((name) => (name === "ozone-platform" ? "x11" : ":2.1"));
  queryX11Extension.mockImplementation((_display, name) => (name === "XWAYLAND" ? 1 : 0));
  clipboardState.initializeClipboardMonitor();

  const request = await clipboardState.watchClipboard();
  expect(openDisplay).toHaveBeenCalledExactlyOnceWith(":2.1");
  expect(queryX11Extension.mock.calls[0]?.[1]).toBe("XWAYLAND");
  expect(closeDisplay).toHaveBeenCalledExactlyOnceWith(1);
  expect(checkEvent).not.toHaveBeenCalled();
  expect(request.needsConfirmation).toBe(true);
  expect(request.needsWindowFocus).toBe(true);
});

it.each([
  [":2.1", ":1", ":2.1"],
  [":2.1", undefined, ":2.1"],
  ["主机:2", ":1", null],
  ["", ":1", null]
] as const)("monitors the X11 --display=%s with DISPLAY=%s", async (override, display, expected) => {
  vi.stubEnv("DISPLAY", display);
  getSwitchValue.mockImplementation((name) => (name === "ozone-platform" ? "x11" : override));
  clipboardState.initializeClipboardMonitor();

  const request = await clipboardState.watchClipboard();
  expect(openDisplay).toHaveBeenCalledExactlyOnceWith(expected);
  expect(request.needsConfirmation).toBe(false);
  expect(request.needsWindowFocus).toBe(false);
  expect(await request.unchanged()).toBe(true);
  checkEvent.mockReturnValueOnce(1);
  expect(await request.unchanged()).toBe(false);
});
