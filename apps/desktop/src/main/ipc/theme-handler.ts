import { ipcMain } from "electron";
import { themeManager } from "../theme";
import type { ThemeMode } from "@shared";
import { wrapIpcHandler } from "./ipc-result";

/**
 * 注册主题相关的 IPC 处理器
 */
export function registerThemeHandlers(): void {
  // 获取当前主题
  ipcMain.handle(
    "theme:get",
    wrapIpcHandler(async () => {
      return themeManager.getTheme();
    }, "THEME_GET_FAILED")
  );

  // 获取主题模式（用户偏好：light / dark / system）
  ipcMain.handle(
    "theme:getMode",
    wrapIpcHandler(async () => {
      return themeManager.getMode();
    }, "THEME_GET_MODE_FAILED")
  );

  // 设置主题
  ipcMain.handle(
    "theme:set",
    wrapIpcHandler(async (theme: ThemeMode) => {
      themeManager.setTheme(theme);
      return;
    }, "THEME_SET_FAILED")
  );
}
