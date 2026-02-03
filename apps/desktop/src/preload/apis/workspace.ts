import { ipcRenderer } from "electron";

export const workspaceApi = {
  /**
   * 选择工作区文件夹
   */
  select: (options?: { title?: string; buttonLabel?: string }): Promise<string | null> =>
    ipcRenderer.invoke("workspace:select", options),

  /**
   * 获取当前工作区路径
   */
  getCurrent: (): Promise<string | null> => ipcRenderer.invoke("workspace:getCurrent"),

  /**
   * 扫描工作区
   */
  scan: (
    workspacePath: string
  ): Promise<{
    folders: Array<{ id: string; name: string; path: string; noteCount: number }>;
    notes: Array<{
      id: string;
      title: string;
      content: string;
      fileName: string;
      filePath: string;
      folderId: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }> => ipcRenderer.invoke("workspace:scan", workspacePath),

  /**
   * 获取最近打开的工作区
   */
  getRecent: (): Promise<string[]> => ipcRenderer.invoke("workspace:getRecent"),

  /**
   * 创建默认工作区
   */
  createDefault: (): Promise<string> => ipcRenderer.invoke("workspace:createDefault"),

  /**
   * 检查默认工作区是否存在
   */
  checkDefaultExists: (): Promise<boolean> => ipcRenderer.invoke("workspace:checkDefaultExists")
};
