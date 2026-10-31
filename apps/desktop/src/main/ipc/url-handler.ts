/**
 * URL Handler - IPC 处理器
 * 处理从渲染进程发来的 URL 抓取请求
 */

import { ipcMain } from "electron";
import { createNoteFromUrl } from "../url-fetcher";
import { wrapIpcHandlerWithEvent } from "./ipc-result";
import { getCallerWorkspace } from "../security/window-context";
import path from "path";
import { validatePathInWorkspace } from "../security/path-validator";

/**
 * 注册 URL 相关的 IPC handlers
 */
export function registerUrlHandlers(): void {
  /**
   * 从 URL 创建笔记
   */
  ipcMain.handle(
    "url:createNote",
    wrapIpcHandlerWithEvent(async (event, url: string, _workspacePath: string, folderId?: string) => {
      const workspacePath = getCallerWorkspace(event);
      if (folderId && !validatePathInWorkspace(workspacePath, path.join(workspacePath, folderId)).isValid) {
        throw new Error("Target folder is outside workspace");
      }
      return await createNoteFromUrl(url, workspacePath, folderId);
    }, "URL_CREATE_NOTE_FAILED")
  );
}
