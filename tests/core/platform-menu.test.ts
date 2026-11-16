import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { buildMenu, setMenu, createWindow, send, focusedWindow } = vi.hoisted(() => ({
  buildMenu: vi.fn((template: Electron.MenuItemConstructorOptions[]) => ({ template })),
  setMenu: vi.fn(),
  createWindow: vi.fn(),
  send: vi.fn(),
  focusedWindow: { current: null as { webContents: { send: ReturnType<typeof vi.fn> } } | null }
}));

vi.mock("electron", () => ({
  app: { name: "Zhiyuan", getLocale: () => "en-US" },
  Menu: { buildFromTemplate: buildMenu, setApplicationMenu: setMenu },
  BrowserWindow: { getFocusedWindow: () => focusedWindow.current }
}));
vi.mock("../../apps/desktop/src/main/window-manager", () => ({ windowManager: { createWindow } }));

import { setupApplicationMenu } from "../../apps/desktop/src/main/menu";

describe("platform application menus", () => {
  const originalPlatform = process.platform;
  beforeEach(() => {
    vi.clearAllMocks();
    focusedWindow.current = { webContents: { send } };
  });
  afterEach(() => Object.defineProperty(process, "platform", { value: originalPlatform }));

  it("keeps Linux file menu actions available through the native menu", () => {
    Object.defineProperty(process, "platform", { value: "linux" });

    setupApplicationMenu();

    expect(buildMenu).toHaveBeenCalledOnce();
    const menu = buildMenu.mock.results[0].value;
    expect(setMenu).toHaveBeenCalledWith(menu);
    const file = menu.template.find((entry) => entry.label === "File");
    const items = file?.submenu as Electron.MenuItemConstructorOptions[];
    for (const label of ["New Window", "Open Folder…", "Open File…"]) {
      const item = items.find((entry) => entry.label === label);
      expect(item?.click).toBeTypeOf("function");
      (item!.click as () => void)();
    }
    expect(createWindow).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith("menu:openFolder");
    expect(send).toHaveBeenCalledWith("menu:openFile");
  });

  it("continues using the existing renderer menu on Windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    setupApplicationMenu();
    expect(setMenu).toHaveBeenCalledWith(null);
    expect(buildMenu).not.toHaveBeenCalled();
  });

  it("keeps the macOS application menu alongside file actions", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    setupApplicationMenu();
    const template = buildMenu.mock.calls[0][0];
    expect(template[0].label).toBe("Zhiyuan");
    expect(template.some((entry) => entry.label === "File")).toBe(true);
  });
});
