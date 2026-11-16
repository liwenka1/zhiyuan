import "./smoke-paths";
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
import { registerGitHubHandlers } from "./ipc/github-handler";
import { registerTerminalHandlers } from "./ipc/terminal-handler";
import { windowManager } from "./window-manager";
import { configManager } from "./config";
import { setupApplicationMenu } from "./menu";
import { pathToFileURL } from "url";
import { existsSync } from "fs";
import fs from "fs";
import path from "path";
import { ipcOk, ipcErr } from "./ipc/ipc-result";
import type { IpcResultDTO } from "@shared";
import { resolveAuthorizedLocalResource } from "./security/local-resource";
import { initializeDiagnostics, recordDiagnostic } from "./diagnostics";
import { registerDiagnosticsHandlers } from "./ipc/diagnostics-handler";
import { getExternalOpenCandidates } from "./external-open-args";
import { startDesktopSmokeTest } from "./desktop-smoke";

type ExternalOpenPayload = {
  workspacePath: string;
  filePath?: string;
};

const pendingExternalOpens: ExternalOpenPayload[] = [];

process.on("uncaughtExceptionMonitor", (error) => {
  recordDiagnostic("main.uncaught-exception", error);
});

process.on("unhandledRejection", (reason) => {
  recordDiagnostic("main.unhandled-rejection", reason);
});

function resolveExternalOpenTarget(targetPath: string): ExternalOpenPayload | null {
  try {
    targetPath = path.resolve(targetPath);
    if (!existsSync(targetPath)) return null;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      return { workspacePath: targetPath };
    }
    if (stat.isFile() && targetPath.toLowerCase().endsWith(".md")) {
      return { workspacePath: path.dirname(targetPath), filePath: targetPath };
    }
  } catch {
    // The path can disappear or become inaccessible between existsSync and statSync.
  }
  return null;
}

function sendExternalOpen(win: BrowserWindow, payload: ExternalOpenPayload): void {
  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("workspace:external-open", payload);
    });
  } else {
    win.webContents.send("workspace:external-open", payload);
  }
}

function handleExternalOpenPath(targetPath: string): boolean {
  const payload = resolveExternalOpenTarget(targetPath);
  if (!payload) return false;

  configManager.addRecentWorkspace(payload.workspacePath);

  if (!app.isReady()) {
    const target = payload.filePath ?? payload.workspacePath;
    if (!pendingExternalOpens.some((entry) => (entry.filePath ?? entry.workspacePath) === target)) {
      pendingExternalOpens.push(payload);
    }
    return true;
  }

  const existingWindows = windowManager.getWindowsForWorkspace(payload.workspacePath);
  if (existingWindows.length > 0) {
    const win = existingWindows[0];
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
    sendExternalOpen(win, payload);
    return true;
  }

  const win = windowManager.createWindow(payload.workspacePath);
  sendExternalOpen(win, payload);
  return true;
}

function handleExternalOpenArguments(argv: string[], workingDirectory = process.cwd()): void {
  for (const candidate of getExternalOpenCandidates(argv, process.defaultApp)) {
    if (handleExternalOpenPath(path.resolve(workingDirectory, candidate))) return;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  // 冷启动时文件关联参数不会触发 second-instance，必须先加入待打开队列。
  handleExternalOpenArguments(process.argv);
  app.on("second-instance", (_event, argv, workingDirectory) => {
    handleExternalOpenArguments(argv, workingDirectory);
  });
}

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  handleExternalOpenPath(filePath);
});

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
  initializeDiagnostics();
  // 注册 local-resource:// 协议处理器
  // 用于加载本地文件资源，正确处理中文路径
  protocol.handle("local-resource", (request) => {
    try {
      const filePath = resolveAuthorizedLocalResource(request.url, (token) =>
        windowManager.getWorkspaceForResourceToken(token)
      );
      if (!filePath) {
        return new Response("File not found", { status: 404 });
      }

      const fileUrl = pathToFileURL(filePath).href;
      return net.fetch(fileUrl);
    } catch {
      return new Response("File not found", { status: 404 });
    }
  });

  // Set app user model id for windows
  electronApp.setAppUserModelId("com.zhiyuan.note");

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

  // macOS/Linux 使用原生菜单；Windows 使用自定义菜单栏。
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

  // 注册 GitHub 相关的 IPC 处理器
  registerGitHubHandlers();

  // 注册终端相关 IPC 处理器
  registerTerminalHandlers();

  registerDiagnosticsHandlers();

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
  if (pendingExternalOpens.length > 0) {
    for (const payload of pendingExternalOpens) {
      const win = windowManager.createWindow(payload.workspacePath);
      sendExternalOpen(win, payload);
    }
    pendingExternalOpens.length = 0;
  } else {
    const lastWorkspace = configManager.getRecentWorkspaces()[0];
    if (lastWorkspace && existsSync(lastWorkspace)) {
      windowManager.createWindow(lastWorkspace);
    } else {
      windowManager.createWindow();
    }
  }

  if (process.env.ZHIYUAN_SMOKE_TEST === "1") startDesktopSmokeTest(windowManager.getAllEntries()[0]?.window);

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
