import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const workspaceApi = {
  /**
   * 选择工作区文件夹
   */
  select: (options?: { title?: string; buttonLabel?: string }): Promise<IpcResultDTO<string | null>> =>
    ipcRenderer.invoke("workspace:select", options),

  /**
   * 获取当前工作区路径
   */
  getCurrent: (): Promise<IpcResultDTO<string | null>> => ipcRenderer.invoke("workspace:getCurrent"),

  /**
   * 扫描工作区
   */
  scan: (
    workspacePath: string
  ): Promise<
    IpcResultDTO<{
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
    }>
  > => ipcRenderer.invoke("workspace:scan", workspacePath),

  /**
   * 打开文件对话框，选择 .md 文件
   */
  openFile: (options?: {
    title?: string;
    buttonLabel?: string;
  }): Promise<IpcResultDTO<{ filePath: string; workspacePath: string } | null>> =>
    ipcRenderer.invoke("workspace:openFile", options),

  /**
   * 获取最近打开的工作区
   */
  getRecent: (): Promise<IpcResultDTO<string[]>> => ipcRenderer.invoke("workspace:getRecent"),

  /**
   * 监听菜单「打开文件夹」事件
   */
  onMenuOpenFolder: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:openFolder", listener);
    return () => ipcRenderer.removeListener("menu:openFolder", listener);
  },

  /**
   * 监听菜单「打开文件」事件
   */
  onMenuOpenFile: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on("menu:openFile", listener);
    return () => ipcRenderer.removeListener("menu:openFile", listener);
  },

  /**
   * 监听外部打开（拖拽到图标等）事件
   */
  onExternalOpen: (callback: (payload: { workspacePath: string; filePath?: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { workspacePath: string; filePath?: string }) =>
      callback(payload);
    ipcRenderer.on("workspace:external-open", listener);
    return () => ipcRenderer.removeListener("workspace:external-open", listener);
  }
};
