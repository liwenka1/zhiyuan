import { app, BrowserWindow, ipcMain, protocol, net } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { themeManager } from "./theme";
import { registerThemeHandlers } from "./ipc/theme-handler";
import { registerWorkspaceHandlers } from "./ipc/workspace-handler";
import { registerExportHandlers } from "./export";
import { registerWindowHandlers } from "./ipc/window-handler";
import { registerRssHandlers } from "./ipc/rss-handler";
import { registerUrlHandlers } from "./ipc/url-handler";
import { windowManager } from "./window-manager";
import { configManager } from "./config";
import { setupApplicationMenu } from "./menu";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import { ipcOk, ipcErr } from "./ipc/ipc-result";
import type { IpcResultDTO } from "@shared";

// 注册自定义协议用于加载本地资源（支持中文路径）
// 必须在 app.whenReady() 之前调用
protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-resource",
    privileges: {
      supportFetchAPI: true,
      stream: true,
      standard: true,
      secure: true
    }
  }
]);

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 注册 local-resource:// 协议处理器
  // 用于加载本地文件资源，正确处理中文路径
  protocol.handle("local-resource", (request) => {
    try {
      const url = new URL(request.url);
      let filePath: string;

      if (process.platform === "win32") {
        // Windows: 重新组合盘符和路径
        // local-resource://D:/path/file.jpg -> D:/path/file.jpg
        const drive = url.hostname.toUpperCase();
        const pathPart = decodeURIComponent(url.pathname);
        filePath = `${drive}:${pathPart}`;
      } else {
        // macOS/Linux: 处理绝对路径
        // local-resource:///Users/path/file.jpg -> /Users/path/file.jpg
        if (url.hostname) {
          // 兼容两个斜杠的格式
          filePath = decodeURIComponent(`/${url.hostname}${url.pathname}`);
        } else {
          filePath = decodeURIComponent(url.pathname);
        }
      }

      const fileUrl = pathToFileURL(filePath).href;
      return net.fetch(fileUrl);
    } catch {
      return new Response("File not found", { status: 404 });
    }
  });

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.electron");

  // macOS: 设置 Dock 图标（开发模式下测试新图标）
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // 设置应用菜单（macOS: 最小化菜单 / Windows & Linux: 移除默认菜单）
  setupApplicationMenu();

  // 初始化主题管理器
  themeManager.init();

  // 注册主题相关的 IPC 处理器
  registerThemeHandlers();

  // 注册工作区和文件系统相关的 IPC 处理器
  registerWorkspaceHandlers();

  // 注册导出相关的 IPC 处理器
  registerExportHandlers();

  // 注册窗口相关的 IPC 处理器
  registerWindowHandlers();

  // 注册 RSS 相关的 IPC 处理器
  registerRssHandlers();

  // 注册 URL 相关的 IPC 处理器
  registerUrlHandlers();

  // 注册新建窗口 IPC
  ipcMain.handle("window:new", (): IpcResultDTO<void> => {
    try {
      windowManager.createWindow();
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WINDOW_NEW_FAILED");
    }
  });

  // 创建第一个窗口，尝试恢复上次的工作区
  const lastWorkspace = configManager.getRecentWorkspaces()[0];
  if (lastWorkspace && existsSync(lastWorkspace)) {
    windowManager.createWindow(lastWorkspace);
  } else {
    windowManager.createWindow();
  }

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
