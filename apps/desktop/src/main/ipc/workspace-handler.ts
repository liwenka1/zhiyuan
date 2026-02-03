import { ipcMain, shell } from "electron";
import { workspaceManager } from "../workspace";
import { fileSystem } from "../file-system";
import { fileWatcher } from "../file-watcher";
import { configManager } from "../config";
import { isSafeUrl, getRejectedProtocol } from "../security/url-validator";
import { wrapIpcHandler, ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO } from "@shared";

/**
 * 注册工作区和文件系统相关的 IPC 处理器
 */
export function registerWorkspaceHandlers(): void {
  // 选择工作区
  ipcMain.handle(
    "workspace:select",
    wrapIpcHandler(async (options?: { title?: string; buttonLabel?: string }) => {
      const workspacePath = await workspaceManager.selectWorkspace(options);
      if (workspacePath) {
        // 启动文件监听
        fileWatcher.startWatching(workspacePath);
      }
      return workspacePath;
    }, "WORKSPACE_SELECT_FAILED")
  );

  // 获取当前工作区
  ipcMain.handle("workspace:getCurrent", (): IpcResultDTO<string | null> => {
    try {
      return ipcOk(workspaceManager.getCurrentWorkspace());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_CURRENT_FAILED");
    }
  });

  // 扫描工作区
  ipcMain.handle(
    "workspace:scan",
    wrapIpcHandler(async (workspacePath: string) => {
      // 扫描工作区时也启动文件监听
      fileWatcher.startWatching(workspacePath);
      return await workspaceManager.scanWorkspace(workspacePath);
    }, "WORKSPACE_SCAN_FAILED")
  );

  // 暂停文件监听
  ipcMain.handle("watcher:pause", (): IpcResultDTO<void> => {
    try {
      fileWatcher.pauseWatching();
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_PAUSE_FAILED");
    }
  });

  // 恢复文件监听
  ipcMain.handle("watcher:resume", (): IpcResultDTO<void> => {
    try {
      fileWatcher.resumeWatching();
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_RESUME_FAILED");
    }
  });

  // 获取最近打开的工作区
  ipcMain.handle("workspace:getRecent", (): IpcResultDTO<string[]> => {
    try {
      return ipcOk(workspaceManager.getRecentWorkspaces());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_RECENT_FAILED");
    }
  });

  // 创建默认工作区
  ipcMain.handle(
    "workspace:createDefault",
    wrapIpcHandler(async () => {
      const workspacePath = await workspaceManager.createDefaultWorkspace();
      if (workspacePath) {
        // 启动文件监听
        fileWatcher.startWatching(workspacePath);
      }
      return workspacePath;
    }, "WORKSPACE_CREATE_DEFAULT_FAILED")
  );

  // 检查默认工作区是否存在
  ipcMain.handle("workspace:checkDefaultExists", (): IpcResultDTO<boolean> => {
    try {
      return ipcOk(workspaceManager.checkDefaultWorkspaceExists());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_CHECK_DEFAULT_FAILED");
    }
  });

  // 读取文件
  ipcMain.handle(
    "file:read",
    wrapIpcHandler(async (filePath: string) => {
      return await fileSystem.readFile(filePath);
    }, "FILE_READ_FAILED")
  );

  // 写入文件
  ipcMain.handle(
    "file:write",
    wrapIpcHandler(async (filePath: string, content: string) => {
      return await fileSystem.writeFile(filePath, content);
    }, "FILE_WRITE_FAILED")
  );

  // 创建文件
  ipcMain.handle(
    "file:create",
    wrapIpcHandler(async (filePath: string, content: string) => {
      return await fileSystem.createFile(filePath, content);
    }, "FILE_CREATE_FAILED")
  );

  // 删除文件
  ipcMain.handle(
    "file:delete",
    wrapIpcHandler(async (filePath: string) => {
      return await fileSystem.deleteFile(filePath);
    }, "FILE_DELETE_FAILED")
  );

  // 重命名文件
  ipcMain.handle(
    "file:rename",
    wrapIpcHandler(async (oldPath: string, newPath: string) => {
      return await fileSystem.renameFile(oldPath, newPath);
    }, "FILE_RENAME_FAILED")
  );

  // 复制文件
  ipcMain.handle(
    "file:copy",
    wrapIpcHandler(async (sourcePath: string, destPath: string) => {
      return await fileSystem.copyFile(sourcePath, destPath);
    }, "FILE_COPY_FAILED")
  );

  // 创建文件夹
  ipcMain.handle(
    "folder:create",
    wrapIpcHandler(async (folderPath: string) => {
      return await fileSystem.createFolder(folderPath);
    }, "FOLDER_CREATE_FAILED")
  );

  // 删除文件夹
  ipcMain.handle(
    "folder:delete",
    wrapIpcHandler(async (folderPath: string) => {
      return await fileSystem.deleteFolder(folderPath);
    }, "FOLDER_DELETE_FAILED")
  );

  // 重命名文件夹
  ipcMain.handle(
    "folder:rename",
    wrapIpcHandler(async (oldPath: string, newPath: string) => {
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
      // shell.openPath 返回空字符串表示成功，否则返回错误信息
      if (errorMessage) {
        throw new Error(errorMessage);
      }
    }, "SHELL_OPEN_PATH_FAILED")
  );

  // 在系统默认浏览器中打开链接
  ipcMain.handle(
    "shell:openExternal",
    wrapIpcHandler(async (url: string) => {
      // 安全检查：只允许安全的协议打开外部链接
      if (!isSafeUrl(url)) {
        const protocol = getRejectedProtocol(url);
        console.warn(`[Security] Blocked unsafe URL protocol: ${protocol} - ${url}`);
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
}
