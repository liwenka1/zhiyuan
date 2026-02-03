import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const urlApi = {
  /**
   * 从 URL 创建笔记
   */
  createNote: (
    url: string,
    workspacePath: string,
    folderId?: string
  ): Promise<
    IpcResultDTO<{
      noteId: string;
      filePath: string;
      title: string;
    }>
  > => ipcRenderer.invoke("url:createNote", url, workspacePath, folderId)
};
