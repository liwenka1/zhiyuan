import { ipcMain, shell, BrowserWindow } from "electron";
import { workspaceManager } from "../workspace";
import { fileSystem } from "../file-system";
import { fileWatcherManager } from "../file-watcher";
import { windowManager } from "../window-manager";
import { configManager } from "../config";
import { isSafeUrl, getRejectedProtocol } from "../security/url-validator";
import { validatePathInWorkspace } from "../security/path-validator";
import { wrapIpcHandler, wrapIpcHandlerWithEvent, ipcOk, ipcErr } from "./ipc-result";
import { normalizeExportLayoutConfig, type ExportLayoutConfig, type IpcResultDTO } from "@shared";

/**
 * 校验文件路径是否在当前窗口的工作区内
 * 通过 event.sender 获取窗口绑定的工作区路径
 */
function assertPathInWorkspace(event: Electron.IpcMainInvokeEvent, filePath: string, operation: string): void {
  const entry = windowManager.getEntryByWebContents(event.sender);
  const workspacePath = entry?.workspacePath;
  if (!workspacePath) {
    throw new Error("No workspace selected");
  }

  const validation = validatePathInWorkspace(workspacePath, filePath);
  if (!validation.isValid) {
    throw new Error(`Access denied (${operation}): path is outside workspace`);
  }
}

/**
 * 从 event 获取调用窗口的 BrowserWindow 实例，找不到则抛出错误
 */
function getCallerWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("Cannot resolve caller window");
  }
  return win;
}

/**
 * 注册工作区和文件系统相关的 IPC 处理器
 */
export function registerWorkspaceHandlers(): void {
  // 选择工作区
  ipcMain.handle(
    "workspace:select",
    wrapIpcHandlerWithEvent(async (event, options?: { title?: string; buttonLabel?: string }) => {
      const win = getCallerWindow(event);
      const workspacePath = await workspaceManager.selectWorkspace(win, options);
      if (workspacePath) {
        // 如果其他窗口已打开该工作区，聚焦过去，当前窗口不变
        if (windowManager.focusExistingWindow(workspacePath, win.id)) {
          return null;
        }
        // 绑定工作区到当前窗口，并启动文件监听
        windowManager.setWorkspacePath(win.id, workspacePath);
        fileWatcherManager.startWatching(workspacePath, win.id);
      }
      return workspacePath;
    }, "WORKSPACE_SELECT_FAILED")
  );

  // 获取当前窗口的工作区
  ipcMain.handle("workspace:getCurrent", (event): IpcResultDTO<string | null> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      return ipcOk(entry?.workspacePath ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_CURRENT_FAILED");
    }
  });

  // 扫描工作区
  ipcMain.handle(
    "workspace:scan",
    wrapIpcHandlerWithEvent(async (event, workspacePath: string) => {
      const win = getCallerWindow(event);
      // 如果其他窗口已打开该工作区，聚焦过去，当前窗口返回 null
      if (windowManager.focusExistingWindow(workspacePath, win.id)) {
        return null;
      }
      // 绑定工作区到当前窗口，并启动文件监听
      windowManager.setWorkspacePath(win.id, workspacePath);
      fileWatcherManager.startWatching(workspacePath, win.id);
      return await workspaceManager.scanWorkspace(workspacePath);
    }, "WORKSPACE_SCAN_FAILED")
  );

  // 暂停文件监听
  ipcMain.handle("watcher:pause", (event): IpcResultDTO<void> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      if (entry?.workspacePath) {
        fileWatcherManager.pauseWatching(entry.workspacePath);
      }
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_PAUSE_FAILED");
    }
  });

  // 恢复文件监听
  ipcMain.handle("watcher:resume", (event): IpcResultDTO<void> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      if (entry?.workspacePath) {
        fileWatcherManager.resumeWatching(entry.workspacePath);
      }
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_RESUME_FAILED");
    }
  });

  // 打开文件
  ipcMain.handle(
    "workspace:openFile",
    wrapIpcHandlerWithEvent(async (event, options?: { title?: string; buttonLabel?: string }) => {
      const win = getCallerWindow(event);
      const result = await workspaceManager.openFile(win, options);
      if (result) {
        // 如果其他窗口已打开该工作区，聚焦过去，当前窗口不变
        if (windowManager.focusExistingWindow(result.workspacePath, win.id)) {
          return null;
        }
        // 绑定工作区到当前窗口，并启动文件监听
        windowManager.setWorkspacePath(win.id, result.workspacePath);
        fileWatcherManager.startWatching(result.workspacePath, win.id);
      }
      return result;
    }, "WORKSPACE_OPEN_FILE_FAILED")
  );

  // 获取最近打开的工作区
  ipcMain.handle("workspace:getRecent", (): IpcResultDTO<string[]> => {
    try {
      return ipcOk(workspaceManager.getRecentWorkspaces());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_RECENT_FAILED");
    }
  });

  // 读取文件（校验路径在工作区内）
  ipcMain.handle(
    "file:read",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      assertPathInWorkspace(event, filePath, "file:read");
      return await fileSystem.readFile(filePath);
    }, "FILE_READ_FAILED")
  );

  // 写入文件（校验路径在工作区内）
  ipcMain.handle(
    "file:write",
    wrapIpcHandlerWithEvent(async (event, filePath: string, content: string) => {
      assertPathInWorkspace(event, filePath, "file:write");
      return await fileSystem.writeFile(filePath, content);
    }, "FILE_WRITE_FAILED")
  );

  // 创建文件（校验路径在工作区内）
  ipcMain.handle(
    "file:create",
    wrapIpcHandlerWithEvent(async (event, filePath: string, content: string) => {
      assertPathInWorkspace(event, filePath, "file:create");
      return await fileSystem.createFile(filePath, content);
    }, "FILE_CREATE_FAILED")
  );

  // 删除文件（校验路径在工作区内）
  ipcMain.handle(
    "file:delete",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      assertPathInWorkspace(event, filePath, "file:delete");
      return await fileSystem.deleteFile(filePath);
    }, "FILE_DELETE_FAILED")
  );

  // 重命名文件（校验源路径和目标路径都在工作区内）
  ipcMain.handle(
    "file:rename",
    wrapIpcHandlerWithEvent(async (event, oldPath: string, newPath: string) => {
      assertPathInWorkspace(event, oldPath, "file:rename (source)");
      assertPathInWorkspace(event, newPath, "file:rename (dest)");
      return await fileSystem.renameFile(oldPath, newPath);
    }, "FILE_RENAME_FAILED")
  );

  // 复制文件（校验源路径和目标路径都在工作区内）
  ipcMain.handle(
    "file:copy",
    wrapIpcHandlerWithEvent(async (event, sourcePath: string, destPath: string) => {
      assertPathInWorkspace(event, sourcePath, "file:copy (source)");
      assertPathInWorkspace(event, destPath, "file:copy (dest)");
      return await fileSystem.copyFile(sourcePath, destPath);
    }, "FILE_COPY_FAILED")
  );

  // 创建文件夹（校验路径在工作区内）
  ipcMain.handle(
    "folder:create",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      assertPathInWorkspace(event, folderPath, "folder:create");
      return await fileSystem.createFolder(folderPath);
    }, "FOLDER_CREATE_FAILED")
  );

  // 删除文件夹（校验路径在工作区内）
  ipcMain.handle(
    "folder:delete",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      assertPathInWorkspace(event, folderPath, "folder:delete");
      return await fileSystem.deleteFolder(folderPath);
    }, "FOLDER_DELETE_FAILED")
  );

  // 重命名文件夹（校验源路径和目标路径都在工作区内）
  ipcMain.handle(
    "folder:rename",
    wrapIpcHandlerWithEvent(async (event, oldPath: string, newPath: string) => {
      assertPathInWorkspace(event, oldPath, "folder:rename (source)");
      assertPathInWorkspace(event, newPath, "folder:rename (dest)");
      return await fileSystem.renameFolder(oldPath, newPath);
    }, "FOLDER_RENAME_FAILED")
  );

  // 在文件管理器中显示文件
  ipcMain.handle("shell:showItemInFolder", (_, fullPath: string): IpcResultDTO<void> => {
    try {
      shell.showItemInFolder(fullPath);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "SHELL_SHOW_ITEM_FAILED");
    }
  });

  // 在文件管理器中打开文件夹
  ipcMain.handle(
    "shell:openPath",
    wrapIpcHandler(async (fullPath: string) => {
      const errorMessage = await shell.openPath(fullPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
    }, "SHELL_OPEN_PATH_FAILED")
  );

  // 在系统默认浏览器中打开链接
  ipcMain.handle(
    "shell:openExternal",
    wrapIpcHandler(async (url: string) => {
      if (!isSafeUrl(url)) {
        const protocol = getRejectedProtocol(url);
        throw new Error(`Unsafe URL protocol: ${protocol}`);
      }
      await shell.openExternal(url);
    }, "SHELL_OPEN_EXTERNAL_FAILED")
  );

  // 获取工作区的置顶笔记
  ipcMain.handle("config:getPinnedNotes", (_, workspacePath: string): IpcResultDTO<string[]> => {
    try {
      const pinnedNotes = configManager.getPinnedNotes(workspacePath);
      return ipcOk(pinnedNotes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_PINNED_FAILED");
    }
  });

  // 设置工作区的置顶笔记
  ipcMain.handle("config:setPinnedNotes", (_, workspacePath: string, noteIds: string[]): IpcResultDTO<void> => {
    try {
      configManager.setPinnedNotes(workspacePath, noteIds);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_PINNED_FAILED");
    }
  });

  // 获取导出主题预设 ID
  ipcMain.handle("config:getExportThemeId", (): IpcResultDTO<string> => {
    try {
      return ipcOk(configManager.getExportThemeId());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_EXPORT_THEME_FAILED");
    }
  });

  // 设置导出主题预设 ID
  // themeId 格式约定：仅允许小写字母、数字和连字符（如 "tech-blue"），与主题文件命名一致
  ipcMain.handle("config:setExportThemeId", (_, themeId: string): IpcResultDTO<void> => {
    try {
      if (typeof themeId !== "string" || themeId.length === 0 || themeId.length > 64 || !/^[a-z0-9-]+$/.test(themeId)) {
        return ipcErr("Invalid themeId", "CONFIG_SET_EXPORT_THEME_INVALID");
      }
      configManager.setExportThemeId(themeId);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_EXPORT_THEME_FAILED");
    }
  });

  // 获取导出布局配置
  ipcMain.handle("config:getExportLayout", (): IpcResultDTO<ExportLayoutConfig> => {
    try {
      return ipcOk(configManager.getExportLayout());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_EXPORT_LAYOUT_FAILED");
    }
  });

  // 设置导出布局配置（允许部分字段更新）
  ipcMain.handle("config:setExportLayout", (_, patch: Partial<ExportLayoutConfig>): IpcResultDTO<void> => {
    try {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return ipcErr("Invalid export layout patch", "CONFIG_SET_EXPORT_LAYOUT_INVALID");
      }
      const normalized = normalizeExportLayoutConfig(patch);
      const sanitizedPatch: Partial<ExportLayoutConfig> = {};
      if ("outerBackground" in patch) sanitizedPatch.outerBackground = normalized.outerBackground;
      if ("innerBackground" in patch) sanitizedPatch.innerBackground = normalized.innerBackground;
      if ("contentWidth" in patch) sanitizedPatch.contentWidth = normalized.contentWidth;
      if ("cardPadding" in patch) sanitizedPatch.cardPadding = normalized.cardPadding;
      if ("baseFontSize" in patch) sanitizedPatch.baseFontSize = normalized.baseFontSize;
      configManager.setExportLayout(sanitizedPatch);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_EXPORT_LAYOUT_FAILED");
    }
  });
}
