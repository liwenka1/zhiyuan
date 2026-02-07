import { Menu, app, BrowserWindow } from "electron";
import { windowManager } from "../window-manager";
import { menuSchema, resolveLabel, toElectronAccelerator, isMenuItem } from "@shared";
import type { MenuLocale, MenuAction, MenuEntryDef } from "@shared";

/**
 * macOS 菜单项动作映射
 * 将 MenuAction 映射到 Electron 原生菜单的 click 处理器
 */
function getActionHandler(action: MenuAction): (() => void) | undefined {
  const handlers: Partial<Record<MenuAction, () => void>> = {
    newWindow: () => windowManager.createWindow(),
    openFolder: () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.webContents.send("menu:openFolder");
    },
    openFile: () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.webContents.send("menu:openFile");
    }
  };
  return handlers[action];
}

/**
 * 将共享菜单项定义转换为 Electron MenuItemConstructorOptions
 */
function toElectronMenuItem(entry: MenuEntryDef, locale: MenuLocale): Electron.MenuItemConstructorOptions {
  if (!isMenuItem(entry)) {
    return { type: "separator" };
  }

  const label = resolveLabel(entry.label, locale);

  // 有 role 的菜单项（编辑类）：让 Electron 原生处理快捷键
  if (entry.role) {
    return {
      role: entry.role as Electron.MenuItemConstructorOptions["role"],
      label
    };
  }

  // 自定义 click 处理器
  const result: Electron.MenuItemConstructorOptions = {
    label,
    click: getActionHandler(entry.id)
  };

  if (entry.shortcut) {
    result.accelerator = toElectronAccelerator(entry.shortcut);
  }

  return result;
}

/**
 * 创建应用菜单
 *
 * - macOS: 从共享 menuSchema 构建原生菜单栏
 * - Windows/Linux: 移除默认菜单（由渲染进程自定义菜单栏接管）
 */
export function setupApplicationMenu(): void {
  if (process.platform === "darwin") {
    const locale: MenuLocale = app.getLocale().startsWith("zh") ? "zh" : "en";

    // macOS 专属：应用名菜单（About / Hide / Quit）
    const appMenu: Electron.MenuItemConstructorOptions = {
      label: app.name,
      submenu: [
        { role: "about", label: locale === "zh" ? `关于 ${app.name}` : `About ${app.name}` },
        { type: "separator" },
        { role: "hide", label: locale === "zh" ? `隐藏 ${app.name}` : `Hide ${app.name}` },
        { type: "separator" },
        { role: "quit", label: locale === "zh" ? `退出 ${app.name}` : `Quit ${app.name}` }
      ]
    };

    // 从共享 schema 构建文件、编辑等菜单
    const menuGroups = menuSchema.map((group) => ({
      label: resolveLabel(group.label, locale),
      submenu: group.items.map((item) => toElectronMenuItem(item, locale))
    }));

    const template: Electron.MenuItemConstructorOptions[] = [appMenu, ...menuGroups];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    // Windows / Linux: 移除默认菜单
    // 编辑快捷键（Ctrl+C/V/X 等）在 webContents 中正常工作
    Menu.setApplicationMenu(null);
  }
}
