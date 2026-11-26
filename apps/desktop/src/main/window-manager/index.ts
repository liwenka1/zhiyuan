import { BrowserWindow, shell, screen, app } from "electron";
import { join, basename, resolve } from "path";
import { pathToFileURL } from "node:url";
import fs from "fs";
import { randomBytes } from "node:crypto";
import { is } from "@electron-toolkit/utils";
import { DEFAULT_TITLE_BAR_HEIGHT, WINDOWS_TITLE_BAR_HEIGHT } from "@shared/title-bar";
import icon from "../../../resources/icon.png?asset";
import { themeManager } from "../theme";
import { getThemeBackgroundColor, getThemeForegroundColor } from "../theme/colors";
import { isSafeUrl } from "../security/url-validator";
import type { WorkspacePathScope } from "../security/path-validator";
import { fileWatcherManager } from "../file-watcher";
import { configManager } from "../config";
import { recordDiagnostic } from "../diagnostics";
import { CloseAttemptTracker } from "./close-attempt";

const CLOSE_FLUSH_TIMEOUT_MS = 10_000;

interface WindowEntry {
  window: BrowserWindow;
  workspacePath: string | null;
  scannedWorkspacePath: string | null;
  workspaceRevision: number;
  localResourceToken: string;
  rendererUrl: string;
}

/**
 * 窗口管理器
 * 追踪所有窗口及其绑定的工作区路径
 */
class WindowManager {
  private windows: Map<number, WindowEntry> = new Map();
  private readonly closeAttempts = new CloseAttemptTracker();
  private quitRequested = false;

  private normalizeWorkspacePath(workspacePath: string): string {
    try {
      return fs.realpathSync.native(workspacePath);
    } catch {
      return resolve(workspacePath);
    }
  }

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
    const localResourceToken = randomBytes(32).toString("hex");
    const normalizedWorkspacePath = workspacePath ? this.normalizeWorkspacePath(workspacePath) : null;
    const rendererFile = join(__dirname, "../renderer/index.html");
    const devRendererUrl = is.dev ? process.env.ELECTRON_RENDERER_URL : undefined;
    const rendererUrl = new URL(devRendererUrl || pathToFileURL(rendererFile)).href;
    const getBackgroundColor = (): string => {
      const theme = themeManager.getTheme();
      return getThemeBackgroundColor(theme);
    };

    const getTitleBarOverlay = () => {
      const theme = themeManager.getTheme();
      return {
        color: getThemeBackgroundColor(theme),
        symbolColor: getThemeForegroundColor(theme),
        height: WINDOWS_TITLE_BAR_HEIGHT
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
      autoHideMenuBar: process.platform === "win32",
      backgroundColor: getBackgroundColor(),
      ...(process.platform === "darwin"
        ? {
            titleBarStyle: "hidden" as const,
            titleBarOverlay: { height: DEFAULT_TITLE_BAR_HEIGHT }
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
        nodeIntegration: false,
        additionalArguments: [`--zhiyuan-resource-token=${localResourceToken}`]
      }
    });

    // 注册到管理器
    this.applyWorkspaceIdentity(win, normalizedWorkspacePath);
    this.windows.set(win.id, {
      window: win,
      workspacePath: normalizedWorkspacePath,
      scannedWorkspacePath: null,
      workspaceRevision: 0,
      localResourceToken,
      rendererUrl: rendererUrl.split("#", 1)[0]
    });

    win.on("ready-to-show", () => {
      win.show();
    });

    // 等待 renderer flush 完待保存内容；无响应时解除关闭拦截，避免未保存内容被强制销毁。
    win.on("close", (event) => {
      // 未绑定工作区没有笔记需要落盘；renderer 启动失败或欢迎页也必须能够关闭。
      if (!this.windows.get(win.id)?.workspacePath) return;
      if (this.closeAttempts.isPending(win.id)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      const closeAttempt = this.closeAttempts.begin(win.id);
      if (!win.isDestroyed()) {
        win.webContents.send("window:prepare-close", closeAttempt);
      }

      setTimeout(() => {
        if (win.isDestroyed() || !this.closeAttempts.isCurrent(win.id, closeAttempt)) {
          return;
        }
        recordDiagnostic("window.close-timeout", new Error("Renderer did not finish saving before close timeout"), {
          windowId: win.id
        });
        this.closeAttempts.cancel(win.id);
        this.quitRequested = false;
        win.show();
      }, CLOSE_FLUSH_TIMEOUT_MS);
    });

    win.webContents.setWindowOpenHandler((details) => {
      if (isSafeUrl(details.url)) {
        shell.openExternal(details.url);
      }
      return { action: "deny" };
    });

    win.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });

    win.webContents.on("render-process-gone", (_event, details) => {
      recordDiagnostic("renderer.process-gone", new Error(details.reason), {
        windowId: win.id,
        exitCode: details.exitCode
      });
    });

    // 窗口关闭时清理
    win.on("closed", () => {
      this.closeAttempts.clear(win.id);
      const entry = this.windows.get(win.id);
      if (entry?.workspacePath) {
        // 将关闭窗口的工作区移到最近列表顶部，以便下次启动恢复
        configManager.addRecentWorkspace(entry.workspacePath);
        fileWatcherManager.stopWatching(entry.workspacePath, win.id);
      }
      this.windows.delete(win.id);
    });

    // Use the authorized URL for navigation so file path characters are encoded identically.
    win.loadURL(rendererUrl);

    return win;
  }

  /**
   * 通过 webContents 获取窗口条目
   */
  getEntryByWebContents(webContents: Electron.WebContents): WindowEntry | undefined {
    const win = BrowserWindow.fromWebContents(webContents);
    if (!win || win.webContents !== webContents) return undefined;
    return this.windows.get(win.id);
  }

  /**
   * 通过窗口 ID 获取条目
   */
  getEntryById(windowId: number): WindowEntry | undefined {
    return this.windows.get(windowId);
  }

  getWorkspaceForResourceToken(token: string): WorkspacePathScope | null {
    for (const entry of this.windows.values()) {
      if (entry.localResourceToken === token && entry.workspacePath && !entry.window.isDestroyed()) {
        return { workspacePath: entry.workspacePath, scannedWorkspacePath: entry.scannedWorkspacePath };
      }
    }
    return null;
  }

  allowClose(windowId: number, closeAttempt: number): void {
    const entry = this.windows.get(windowId);
    if (!entry || entry.window.isDestroyed() || !this.closeAttempts.isCurrent(windowId, closeAttempt)) {
      return;
    }
    this.closeAttempts.complete(windowId, closeAttempt);
    entry.window.destroy();
  }

  deferQuit(event: Pick<Electron.Event, "preventDefault">): void {
    const entries = this.getAllEntries();
    if (!entries.some((entry) => entry.workspacePath)) return;
    // Electron forgets a native quit if a window cancels its close event for the async save handshake.
    event.preventDefault();
    this.quitRequested = true;
    for (const { window } of entries) {
      if (!window.isDestroyed() && !this.closeAttempts.isPending(window.id)) window.close();
    }
  }

  takeQuitRequest(): boolean {
    const requested = this.quitRequested;
    this.quitRequested = false;
    return requested;
  }

  beginWorkspaceSwitch(windowId: number, workspacePath: string | null): void {
    const entry = this.windows.get(windowId);
    if (entry && (entry.scannedWorkspacePath ?? entry.workspacePath) !== workspacePath) {
      entry.workspaceRevision += 1;
    }
  }

  /**
   * 设置窗口的工作区路径
   */
  setWorkspacePath(windowId: number, workspacePath: string | null): void {
    const entry = this.windows.get(windowId);
    if (entry) {
      const normalizedWorkspacePath = workspacePath ? this.normalizeWorkspacePath(workspacePath) : null;
      // 如果之前有工作区，先解绑文件监听
      if (entry.workspacePath && entry.workspacePath !== normalizedWorkspacePath) {
        fileWatcherManager.stopWatching(entry.workspacePath, windowId);
      }
      if (entry.workspacePath !== normalizedWorkspacePath || entry.scannedWorkspacePath !== workspacePath) {
        entry.workspaceRevision += 1;
      }
      entry.workspacePath = normalizedWorkspacePath;
      entry.scannedWorkspacePath = workspacePath;
      this.applyWorkspaceIdentity(entry.window, normalizedWorkspacePath);
    }
  }

  /**
   * 检查是否有其他窗口已打开指定工作区，如有则聚焦并返回 true
   * @param workspacePath 要检查的工作区路径
   * @param excludeWindowId 排除的窗口 ID（通常是调用方自身）
   */
  focusExistingWindow(workspacePath: string, excludeWindowId: number): boolean {
    const entry = this.findWorkspaceEntry(workspacePath, excludeWindowId);
    if (!entry) return false;
    if (entry.window.isMinimized()) {
      entry.window.restore();
    }
    entry.window.focus();
    return true;
  }

  /**
   * 用工作区的规范路径查找窗口，同时保留渲染端扫描时使用的路径。
   */
  findWorkspaceEntry(workspacePath: string, excludeWindowId?: number): WindowEntry | undefined {
    const normalizedWorkspacePath = this.normalizeWorkspacePath(workspacePath);
    for (const [id, entry] of this.windows) {
      if (id !== excludeWindowId && entry.workspacePath === normalizedWorkspacePath && !entry.window.isDestroyed()) {
        return entry;
      }
    }
    return undefined;
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
