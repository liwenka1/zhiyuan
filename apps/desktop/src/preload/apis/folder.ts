import { ipcRenderer } from "electron";

export const folderApi = {
  /**
   * 创建文件夹
   */
  create: (folderPath: string): Promise<void> => ipcRenderer.invoke("folder:create", folderPath),

  /**
   * 删除文件夹
   */
  delete: (folderPath: string): Promise<void> => ipcRenderer.invoke("folder:delete", folderPath),

  /**
   * 重命名文件夹
   */
  rename: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke("folder:rename", oldPath, newPath),

  /**
   * 监听文件夹添加
   */
  onAdded: (callback: (data: { folderPath: string; fullPath: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { folderPath: string; fullPath: string }) => {
      callback(data);
    };
    ipcRenderer.on("folder:added", listener);
    return () => {
      ipcRenderer.removeListener("folder:added", listener);
    };
  },

  /**
   * 监听文件夹删除
   */
  onDeleted: (callback: (data: { folderPath: string; fullPath: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { folderPath: string; fullPath: string }) => {
      callback(data);
    };
    ipcRenderer.on("folder:deleted", listener);
    return () => {
      ipcRenderer.removeListener("folder:deleted", listener);
    };
  }
};
