import { ipcMain, IpcMainInvokeEvent } from "electron";
import { themeManager } from "../theme";
import type { Theme } from "@shared";

/**
 * 注册主题相关的 IPC 处理器
 */
export function registerThemeHandlers(): void {
  // 获取当前主题
  ipcMain.handle("theme:get", async (): Promise<Theme> => {
    return themeManager.getTheme();
  });

  // 设置主题
  ipcMain.handle("theme:set", async (_event: IpcMainInvokeEvent, theme: Theme): Promise<void> => {
    themeManager.setTheme(theme);
  });
}

/**
 * 移除主题相关的 IPC 处理器
 */
export function unregisterThemeHandlers(): void {
  ipcMain.removeHandler("theme:get");
  ipcMain.removeHandler("theme:set");
}
