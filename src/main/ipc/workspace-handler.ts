import { ipcMain } from "electron";
import { workspaceManager } from "../workspace";
import { fileSystem } from "../file-system";
import { fileWatcher } from "../file-watcher";

/**
 * 注册工作区和文件系统相关的 IPC 处理器
 */
export function registerWorkspaceHandlers(): void {
  // 选择工作区
  ipcMain.handle("workspace:select", async () => {
    const workspacePath = await workspaceManager.selectWorkspace();
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
    return await workspaceManager.scanWorkspace(workspacePath);
  });

  // 获取最近打开的工作区
  ipcMain.handle("workspace:getRecent", () => {
    return workspaceManager.getRecentWorkspaces();
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

  // 创建文件夹
  ipcMain.handle("folder:create", async (_, folderPath: string) => {
    return await fileSystem.createFolder(folderPath);
  });

  // 删除文件夹
  ipcMain.handle("folder:delete", async (_, folderPath: string) => {
    return await fileSystem.deleteFolder(folderPath);
  });

  console.log("工作区 IPC 处理器已注册");
}
