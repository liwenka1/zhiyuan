import { app } from "electron";
import { loadPackagedKoffi, requireNative } from "../native/koffi";
import { openWaylandClipboard, type WaylandClipboard } from "./wayland-clipboard";
import { openX11Clipboard } from "./x11-clipboard";

type ChangeToken = string | number | bigint;
type ReadChangeToken = () => ChangeToken | undefined;

export interface ClipboardWatch {
  unchanged: () => boolean | Promise<boolean>;
  needsConfirmation: boolean;
  needsWindowFocus: boolean;
}

let needsFocusedConfirmation = false;
let waylandClipboard: WaylandClipboard | undefined;

export function initializeClipboardMonitor(): void {
  if (process.platform !== "linux") return;
  const ozone = app.commandLine?.getSwitchValue("ozone-platform");
  const waylandSession = process.env.XDG_SESSION_TYPE === "wayland";
  const hasWaylandDisplay = !!process.env.WAYLAND_DISPLAY;
  const wayland =
    ozone === "wayland" ||
    ((!ozone || ozone === "auto") && (waylandSession || (!process.env.DISPLAY && hasWaylandDisplay)));
  // Under XWayland, XFixes can miss copies made while a native Wayland window has focus.
  needsFocusedConfirmation = wayland || waylandSession || hasWaylandDisplay || process.env.WAYLAND_SOCKET !== undefined;
  if (wayland) {
    void openWaylandClipboard()
      .then((monitor) => {
        waylandClipboard = monitor;
      })
      .catch(() => {});
  }
}

function loadNativeClipboardReader(): ReadChangeToken | undefined {
  if (process.platform === "linux") {
    if (needsFocusedConfirmation) return;
    const display = app.commandLine?.getSwitchValue("display") ?? "";
    // Chromium's ASCII-only switch falls back to DISPLAY for non-ASCII values.
    const reader = openX11Clipboard(Buffer.byteLength(display) === display.length ? display : undefined);
    if (reader === "xwayland") {
      needsFocusedConfirmation = true;
      return;
    }
    return reader;
  }
  if (process.platform !== "darwin" && process.platform !== "win32") return;
  const koffi = loadPackagedKoffi() ?? (requireNative("koffi") as typeof import("koffi"));
  if (process.platform === "win32") {
    const user = koffi.load("user32.dll");
    const sequence = user.func("__stdcall", "GetClipboardSequenceNumber", "uint32_t", []);
    const owner = user.func("__stdcall", "GetClipboardOwner", "uintptr_t", []);
    return () => {
      const sequenceNumber = sequence();
      // Windows can defer rendering a new owner's clipboard data.
      return sequenceNumber ? `${sequenceNumber}:${owner()}` : undefined;
    };
  }

  const objc = koffi.load("/usr/lib/libobjc.A.dylib");
  const getClass = objc.func("objc_getClass", "void *", ["str"]);
  const selector = objc.func("sel_registerName", "void *", ["str"]);
  const pasteboardClass = getClass("NSPasteboard");
  if (!pasteboardClass) return;
  const send = objc.func("objc_msgSend", "void *", ["void *", "void *"]);
  const sendCount = objc.func("objc_msgSend", "intptr_t", ["void *", "void *"]);
  const generalPasteboard = selector("generalPasteboard");
  const changeCount = selector("changeCount");
  return () => {
    const pasteboard = send(pasteboardClass, generalPasteboard);
    return pasteboard ? sendCount(pasteboard, changeCount) : undefined;
  };
}

let nativeReader: ReadChangeToken | null | undefined;

/** Capture clipboard state before rendering a copy, using only the system change signal where available. */
export async function watchClipboard(): Promise<ClipboardWatch> {
  const compositor = waylandClipboard;
  if (compositor) {
    const baseline = await compositor.sync();
    if (baseline !== undefined) {
      return {
        // Include any newer offers delivered in the same read as the final sync reply.
        unchanged: async () => (await compositor.sync()) !== undefined && compositor.revision() === baseline,
        needsConfirmation: false,
        needsWindowFocus: true
      };
    }
  }

  try {
    if (nativeReader === undefined) nativeReader = loadNativeClipboardReader() ?? null;
    const read = nativeReader;
    const baseline = read?.();
    if (read && baseline !== undefined) {
      return {
        needsConfirmation: false,
        needsWindowFocus: false,
        unchanged() {
          try {
            return baseline === read();
          } catch {
            return false;
          }
        }
      };
    }
  } catch {
    nativeReader = null;
  }

  // Comparing payloads misses same-content copies and can block on the clipboard owner.
  return { unchanged: () => true, needsConfirmation: true, needsWindowFocus: needsFocusedConfirmation };
}
