import { ipcMain, BrowserWindow } from "electron";

/**
 * 注册窗口相关的 IPC 处理器
 */
export function registerWindowHandlers(): void {
  // 设置窗口全屏状态
  ipcMain.handle("window:setFullScreen", (event, fullScreen: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setFullScreen(fullScreen);
    }
  });

  // 获取窗口全屏状态
  ipcMain.handle("window:isFullScreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isFullScreen() : false;
  });
}
