import { ipcRenderer } from "electron";

export const fileApi = {
  /**
   * 读取文件
   */
  read: (filePath: string): Promise<{ content: string; mtime: number }> => ipcRenderer.invoke("file:read", filePath),

  /**
   * 写入文件
   */
  write: (filePath: string, content: string): Promise<{ mtime: number }> =>
    ipcRenderer.invoke("file:write", filePath, content),

  /**
   * 创建文件
   */
  create: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke("file:create", filePath, content),

  /**
   * 删除文件
   */
  delete: (filePath: string): Promise<void> => ipcRenderer.invoke("file:delete", filePath),

  /**
   * 重命名文件
   */
  rename: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke("file:rename", oldPath, newPath),

  /**
   * 复制文件
   */
  copy: (sourcePath: string, destPath: string): Promise<void> => ipcRenderer.invoke("file:copy", sourcePath, destPath),

  /**
   * 监听文件变化
   */
  onChanged: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
      callback(data);
    };
    ipcRenderer.on("file:changed", listener);
    return () => {
      ipcRenderer.removeListener("file:changed", listener);
    };
  },

  /**
   * 监听文件添加
   */
  onAdded: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
      callback(data);
    };
    ipcRenderer.on("file:added", listener);
    return () => {
      ipcRenderer.removeListener("file:added", listener);
    };
  },

  /**
   * 监听文件删除
   */
  onDeleted: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
      callback(data);
    };
    ipcRenderer.on("file:deleted", listener);
    return () => {
      ipcRenderer.removeListener("file:deleted", listener);
    };
  }
};
