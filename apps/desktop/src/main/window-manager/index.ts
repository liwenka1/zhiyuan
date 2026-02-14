import { BrowserWindow, shell, screen, app } from "electron";
import { join, basename } from "path";
import { is } from "@electron-toolkit/utils";
import icon from "../../../resources/icon.png?asset";
import { themeManager } from "../theme";
import { getThemeBackgroundColor, getThemeForegroundColor } from "../theme/colors";
import { isSafeUrl } from "../security/url-validator";
import { fileWatcherManager } from "../file-watcher";
import { configManager } from "../config";

interface WindowEntry {
  window: BrowserWindow;
  workspacePath: string | null;
}

/**
 * 窗口管理器
 * 追踪所有窗口及其绑定的工作区路径
 */
class WindowManager {
  private windows: Map<number, WindowEntry> = new Map();

  /**
   * 生成窗口标题：
   * - 未绑定工作区：应用名
   * - 已绑定工作区：工作区文件夹名
   */
  private getWindowTitle(workspacePath: string | null): string {
    if (!workspacePath) {
      return app.name;
    }
    const folderName = basename(workspacePath);
    return folderName || app.name;
  }

  /**
   * 同步窗口身份信息（标题 / macOS represented filename）
   */
  private applyWorkspaceIdentity(win: BrowserWindow, workspacePath: string | null): void {
    win.setTitle(this.getWindowTitle(workspacePath));

    if (process.platform === "darwin") {
      win.setRepresentedFilename(workspacePath ?? "");
    }
  }

  /**
   * 创建新窗口
   */
  createWindow(workspacePath?: string): BrowserWindow {
    const getBackgroundColor = (): string => {
      const theme = themeManager.getTheme();
      return getThemeBackgroundColor(theme);
    };

    const getTitleBarOverlay = () => {
      const theme = themeManager.getTheme();
      return {
        color: getThemeBackgroundColor(theme),
        symbolColor: getThemeForegroundColor(theme),
        height: 32
      };
    };

    // 计算窗口位置：有偏移，避免完全重叠
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 1280;
    const windowHeight = 752;
    const offset = this.windows.size * 30;
    const x = Math.round((screenWidth - windowWidth) / 2) + offset;
    const y = Math.round(screenHeight * 0.15) + offset;

    const win = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      minWidth: 1000,
      minHeight: 600,
      x,
      y,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: getBackgroundColor(),
      ...(process.platform === "darwin"
        ? {
            titleBarStyle: "hidden" as const
          }
        : {}),
      ...(process.platform === "win32"
        ? {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: getTitleBarOverlay()
          }
        : {}),
      icon,
      webPreferences: {
        preload: join(__dirname, "../preload/index.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // 注册到管理器
    this.applyWorkspaceIdentity(win, workspacePath ?? null);
    this.windows.set(win.id, {
      window: win,
      workspacePath: workspacePath ?? null
    });

    win.on("ready-to-show", () => {
      win.show();
    });

    win.webContents.setWindowOpenHandler((details) => {
      if (isSafeUrl(details.url)) {
        shell.openExternal(details.url);
      }
      return { action: "deny" };
    });

    // 监听主题变化，动态更新窗口背景色和标题栏
    win.webContents.on("ipc-message", (_event, channel) => {
      if (channel === "theme:changed") {
        win.setBackgroundColor(getBackgroundColor());
        if (process.platform === "win32") {
          win.setTitleBarOverlay(getTitleBarOverlay());
        }
      }
    });

    // 窗口关闭时清理
    win.on("closed", () => {
      const entry = this.windows.get(win.id);
      if (entry?.workspacePath) {
        // 将关闭窗口的工作区移到最近列表顶部，以便下次启动恢复
        configManager.addRecentWorkspace(entry.workspacePath);
        fileWatcherManager.stopWatching(entry.workspacePath, win.id);
      }
      this.windows.delete(win.id);
    });

    // 加载页面
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
      win.loadFile(join(__dirname, "../renderer/index.html"));
    }

    return win;
  }

  /**
   * 通过 webContents 获取窗口条目
   */
  getEntryByWebContents(webContents: Electron.WebContents): WindowEntry | undefined {
    const win = BrowserWindow.fromWebContents(webContents);
    if (!win) return undefined;
    return this.windows.get(win.id);
  }

  /**
   * 通过窗口 ID 获取条目
   */
  getEntryById(windowId: number): WindowEntry | undefined {
    return this.windows.get(windowId);
  }

  /**
   * 设置窗口的工作区路径
   */
  setWorkspacePath(windowId: number, workspacePath: string | null): void {
    const entry = this.windows.get(windowId);
    if (entry) {
      // 如果之前有工作区，先解绑文件监听
      if (entry.workspacePath && entry.workspacePath !== workspacePath) {
        fileWatcherManager.stopWatching(entry.workspacePath, windowId);
      }
      entry.workspacePath = workspacePath;
      this.applyWorkspaceIdentity(entry.window, workspacePath);
    }
  }

  /**
   * 检查是否有其他窗口已打开指定工作区，如有则聚焦并返回 true
   * @param workspacePath 要检查的工作区路径
   * @param excludeWindowId 排除的窗口 ID（通常是调用方自身）
   */
  focusExistingWindow(workspacePath: string, excludeWindowId: number): boolean {
    for (const [id, entry] of this.windows) {
      if (id !== excludeWindowId && entry.workspacePath === workspacePath && !entry.window.isDestroyed()) {
        // 聚焦已有窗口
        if (entry.window.isMinimized()) {
          entry.window.restore();
        }
        entry.window.focus();
        return true;
      }
    }
    return false;
  }

  /**
   * 获取绑定了指定工作区的所有窗口
   */
  getWindowsForWorkspace(workspacePath: string): BrowserWindow[] {
    const result: BrowserWindow[] = [];
    for (const entry of this.windows.values()) {
      if (entry.workspacePath === workspacePath && !entry.window.isDestroyed()) {
        result.push(entry.window);
      }
    }
    return result;
  }

  /**
   * 获取所有窗口条目
   */
  getAllEntries(): WindowEntry[] {
    return Array.from(this.windows.values());
  }

  /**
   * 获取窗口数量
   */
  getWindowCount(): number {
    return this.windows.size;
  }
}

export const windowManager = new WindowManager();
