import { handleAppIpc } from "../security/app-ipc";
/**
 * URL Handler - IPC 处理器
 * 处理从渲染进程发来的 URL 抓取请求
 */

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
  handleAppIpc(
    "url:createNote",
    wrapIpcHandlerWithEvent(async (event, url: string, _workspacePath: string, folderId?: string) => {
      const workspacePath = getCallerWorkspace(event);
      const root = validatePathInWorkspace(workspacePath, workspacePath);
      const target = validatePathInWorkspace(workspacePath, path.join(workspacePath, folderId || ""));
      if (!root.isValid || !target.isValid) {
        throw new Error("Target folder is outside workspace");
      }
      const relativeFolder = path.relative(root.normalizedPath, target.normalizedPath).split(path.sep).join("/");
      return await createNoteFromUrl(url, root.normalizedPath, relativeFolder);
    }, "URL_CREATE_NOTE_FAILED")
  );
}
