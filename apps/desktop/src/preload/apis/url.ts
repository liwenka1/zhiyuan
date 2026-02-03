import { ipcRenderer } from "electron";

export const urlApi = {
  /**
   * 从 URL 创建笔记
   */
  createNote: (
    url: string,
    workspacePath: string,
    folderId?: string
  ): Promise<{
    noteId: string;
    filePath: string;
    title: string;
  }> => ipcRenderer.invoke("url:createNote", url, workspacePath, folderId)
};
