/**
 * URL Handler - IPC 处理器
 * 处理从渲染进程发来的 URL 抓取请求
 */

import { ipcMain } from "electron";
import { createNoteFromUrl } from "../url-fetcher";

/**
 * 注册 URL 相关的 IPC handlers
 */
export function registerUrlHandlers(): void {
  /**
   * 从 URL 创建笔记
   */
  ipcMain.handle("url:createNote", async (_, url: string, workspacePath: string, folderId?: string) => {
    return await createNoteFromUrl(url, workspacePath, folderId);
  });
}
