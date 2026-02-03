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
  ipcMain.handle("workspace:select", async (_, options?: { title?: string; buttonLabel?: string }) => {
    const workspacePath = await workspaceManager.selectWorkspace(options);
    if (workspacePath) {
      // 启动文件监听
      fileWatcher.startWatching(workspacePath);
    }
    return workspacePath;
  });

  // 获取当前工作区
  ipcMain.handle("workspace:getCurrent", () => {
    return workspaceManager.getCurrentWorkspace();
  });

  // 扫描工作区
  ipcMain.handle("workspace:scan", async (_, workspacePath: string) => {
    // 扫描工作区时也启动文件监听
    fileWatcher.startWatching(workspacePath);
    return await workspaceManager.scanWorkspace(workspacePath);
  });

  // 暂停文件监听
  ipcMain.handle("watcher:pause", () => {
    fileWatcher.pauseWatching();
  });

  // 恢复文件监听
  ipcMain.handle("watcher:resume", () => {
    fileWatcher.resumeWatching();
  });

  // 获取最近打开的工作区
  ipcMain.handle("workspace:getRecent", () => {
    return workspaceManager.getRecentWorkspaces();
  });

  // 创建默认工作区
  ipcMain.handle("workspace:createDefault", async () => {
    const workspacePath = await workspaceManager.createDefaultWorkspace();
    if (workspacePath) {
      // 启动文件监听
      fileWatcher.startWatching(workspacePath);
    }
    return workspacePath;
  });

  // 检查默认工作区是否存在
  ipcMain.handle("workspace:checkDefaultExists", () => {
    return workspaceManager.checkDefaultWorkspaceExists();
  });

  // 读取文件
  ipcMain.handle("file:read", async (_, filePath: string) => {
    return await fileSystem.readFile(filePath);
  });

  // 写入文件
  ipcMain.handle("file:write", async (_, filePath: string, content: string) => {
    return await fileSystem.writeFile(filePath, content);
  });

  // 创建文件
  ipcMain.handle("file:create", async (_, filePath: string, content: string) => {
    return await fileSystem.createFile(filePath, content);
  });

  // 删除文件
  ipcMain.handle("file:delete", async (_, filePath: string) => {
    return await fileSystem.deleteFile(filePath);
  });

  // 重命名文件
  ipcMain.handle("file:rename", async (_, oldPath: string, newPath: string) => {
    return await fileSystem.renameFile(oldPath, newPath);
  });

  // 复制文件
  ipcMain.handle("file:copy", async (_, sourcePath: string, destPath: string) => {
    return await fileSystem.copyFile(sourcePath, destPath);
  });

  // 创建文件夹
  ipcMain.handle("folder:create", async (_, folderPath: string) => {
    return await fileSystem.createFolder(folderPath);
  });

  // 删除文件夹
  ipcMain.handle("folder:delete", async (_, folderPath: string) => {
    return await fileSystem.deleteFolder(folderPath);
  });

  // 重命名文件夹
  ipcMain.handle("folder:rename", async (_, oldPath: string, newPath: string) => {
    return await fileSystem.renameFolder(oldPath, newPath);
  });

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
