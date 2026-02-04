import { app, shell, BrowserWindow, screen, protocol, net } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import icon from "../../resources/icon.png?asset";
import { themeManager } from "./theme";
import { registerThemeHandlers } from "./ipc/theme-handler";
import { registerWorkspaceHandlers } from "./ipc/workspace-handler";
import { registerExportHandlers } from "./ipc/export-handler";
import { registerWindowHandlers } from "./ipc/window-handler";
import { registerRssHandlers } from "./ipc/rss-handler";
import { registerUrlHandlers } from "./ipc/url-handler";
import { pathToFileURL } from "url";
import { getThemeBackgroundColor, getThemeForegroundColor } from "@shared";
import { isSafeUrl } from "./security/url-validator";

function createWindow(): void {
  // 获取当前主题对应的背景色
  const getBackgroundColor = (): string => {
    const theme = themeManager.getTheme();
    return getThemeBackgroundColor(theme);
  };

  // 获取标题栏覆盖层配置（用于 Windows）
  const getTitleBarOverlay = () => {
    const theme = themeManager.getTheme();
    return {
      color: getThemeBackgroundColor(theme),
      symbolColor: getThemeForegroundColor(theme),
      height: 32
    };
  };

  // 计算窗口初始位置
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 1280;
  const windowHeight = 752;
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round(screenHeight * 0.15);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 1000,
    minHeight: 600,
    x: x,
    y: y,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: getBackgroundColor(),
    // macOS: 隐藏标题栏但保留红黄绿按钮
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hidden"
        }
      : {}),
    // Windows: 使用 titleBarOverlay 自定义标题栏颜色，不显示图标
    ...(process.platform === "win32"
      ? {
          titleBarStyle: "hidden",
          titleBarOverlay: getTitleBarOverlay()
        }
      : {}),
    icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      sandbox: true, // 启用沙盒，提升安全性
      contextIsolation: true, // 启用上下文隔离（默认值，显式声明）
      nodeIntegration: false // 禁用 Node.js 集成（默认值，显式声明）
    }
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // 安全检查：只允许安全的协议打开外部链接
    if (isSafeUrl(details.url)) {
      shell.openExternal(details.url);
    }
    return { action: "deny" };
  });

  // 监听主题变化，动态更新窗口背景色和标题栏
  mainWindow.webContents.on("ipc-message", (_event, channel) => {
    if (channel === "theme:changed") {
      mainWindow.setBackgroundColor(getBackgroundColor());
      // Windows: 动态更新标题栏颜色
      if (process.platform === "win32") {
        mainWindow.setTitleBarOverlay(getTitleBarOverlay());
      }
    }
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

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

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
