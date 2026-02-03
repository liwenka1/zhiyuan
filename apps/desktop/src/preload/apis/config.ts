import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const configApi = {
  /**
   * 获取工作区的置顶笔记列表
   */
  getPinnedNotes: (workspacePath: string): Promise<IpcResultDTO<string[]>> =>
    ipcRenderer.invoke("config:getPinnedNotes", workspacePath),

  /**
   * 设置工作区的置顶笔记列表
   */
  setPinnedNotes: (workspacePath: string, noteIds: string[]): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setPinnedNotes", workspacePath, noteIds)
};
