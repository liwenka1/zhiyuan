import { ipcMain, BrowserWindow } from "electron";
import { ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO } from "@shared";
import { windowManager } from "../window-manager";

/**
 * 注册窗口相关的 IPC 处理器
 */
export function registerWindowHandlers(): void {
  ipcMain.handle("window:readyToClose", (event): IpcResultDTO<void> => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return ipcErr("无法获取窗口实例", "WINDOW_NOT_FOUND");
      setImmediate(() => windowManager.allowClose(win.id));
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WINDOW_READY_TO_CLOSE_FAILED");
    }
  });

  // 设置窗口全屏状态
  ipcMain.handle("window:setFullScreen", (event, fullScreen: boolean): IpcResultDTO<void> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return ipcErr("无法获取窗口实例", "WINDOW_NOT_FOUND");
    }
    win.setFullScreen(fullScreen);
    return ipcOk(undefined);
  });

  // 获取窗口全屏状态
  ipcMain.handle("window:isFullScreen", (event): IpcResultDTO<boolean> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return ipcErr("无法获取窗口实例", "WINDOW_NOT_FOUND");
    }
    return ipcOk(win.isFullScreen());
  });
}
