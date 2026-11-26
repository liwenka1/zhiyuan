import { loadPackagedKoffi, requireNative } from "../native/koffi";

/** Track owner changes on native X11, including repeated copies by the same owner. */
export function openX11Clipboard(displayOverride?: string): (() => number) | "xwayland" | undefined {
  if (!displayOverride && !process.env.DISPLAY) return;
  const koffi = loadPackagedKoffi() ?? (requireNative("koffi") as typeof import("koffi"));
  const x11 = koffi.load("libX11.so.6");
  const openDisplay = x11.func("XOpenDisplay", "void *", ["str"]);
  const closeDisplay = x11.func("XCloseDisplay", "int", ["void *"]);
  const rootWindow = x11.func("XDefaultRootWindow", "ulong", ["void *"]);
  const internAtom = x11.func("XInternAtom", "ulong", ["void *", "str", "int"]);
  const sync = x11.func("XSync", "int", ["void *", "int"]);
  const checkEvent = x11.func("XCheckTypedEvent", "int", ["void *", "int", "void *"]);
  const queryExtension = x11.func("XQueryExtension", "int", ["void *", "str", "int *", "int *", "int *"]);

  const display = openDisplay(displayOverride || null);
  if (!display) return;
  const eventBase = Buffer.alloc(4);
  let installed = false;
  try {
    if (queryExtension(display, "XWAYLAND", Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(4))) return "xwayland";

    const fixes = koffi.load("libXfixes.so.3");
    const queryFixes = fixes.func("XFixesQueryExtension", "int", ["void *", "int *", "int *"]);
    const queryVersion = fixes.func("XFixesQueryVersion", "int", ["void *", "int *", "int *"]);
    const selectInput = fixes.func("XFixesSelectSelectionInput", "void", ["void *", "ulong", "ulong", "ulong"]);
    if (!queryFixes(display, eventBase, Buffer.alloc(4))) return;
    const majorVersion = Buffer.alloc(4);
    if (!queryVersion(display, majorVersion, Buffer.alloc(4)) || majorVersion.readInt32LE() < 1) return;
    const clipboard = internAtom(display, "CLIPBOARD", 0);
    // Owner set, owner window destroyed, and owner client disconnected.
    selectInput(display, rootWindow(display), clipboard, 0b111);
    const event = Buffer.alloc(24 * koffi.sizeof("long")); // XEvent.pad[24]
    const selectionNotify = eventBase.readInt32LE();
    let changes = 0;
    installed = true;
    return () => {
      sync(display, 0);
      while (checkEvent(display, selectionNotify, event)) changes += 1;
      return changes;
    };
  } finally {
    if (!installed) closeDisplay(display);
  }
}
