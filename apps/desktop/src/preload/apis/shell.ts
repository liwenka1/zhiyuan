import { ipcRenderer } from "electron";

export const shellApi = {
  /**
   * 在文件管理器中显示文件
   */
  showItemInFolder: (fullPath: string): Promise<void> => ipcRenderer.invoke("shell:showItemInFolder", fullPath),

  /**
   * 在文件管理器中打开文件夹
   */
  openPath: (fullPath: string): Promise<string> => ipcRenderer.invoke("shell:openPath", fullPath),

  /**
   * 在系统默认浏览器中打开链接
   */
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url)
};
