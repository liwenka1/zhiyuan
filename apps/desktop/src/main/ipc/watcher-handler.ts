import { BrowserWindow } from "electron";
import { handleAppIpc } from "../security/app-ipc";
import type { IpcResultDTO } from "@shared";
import { fileWatcherManager } from "../file-watcher";
import { windowManager } from "../window-manager";
import { ipcOk, ipcErr } from "./ipc-result";
import fs from "fs";
import path from "path";

function normalizeWorkspacePath(workspacePath: string): string {
  try {
    return fs.realpathSync.native(workspacePath);
  } catch {
    return path.resolve(workspacePath);
  }
}

function resolveExpectedWorkspacePath(expectedPath: unknown, currentPath?: string | null): string | undefined {
  if (expectedPath === undefined) return currentPath ? normalizeWorkspacePath(currentPath) : undefined;
  if (typeof expectedPath !== "string" || !expectedPath.trim()) throw new Error("Invalid workspace path");
  return normalizeWorkspacePath(expectedPath);
}

export function registerWatcherHandlers(): void {
  handleAppIpc("watcher:pause", (event, expectedWorkspacePath?: string): IpcResultDTO<void> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      const workspacePath = resolveExpectedWorkspacePath(expectedWorkspacePath, entry?.workspacePath);
      if (workspacePath && windowId !== undefined) {
        if (!entry?.workspacePath || normalizeWorkspacePath(entry.workspacePath) !== workspacePath) {
          throw new Error("Workspace changed before pausing the watcher");
        }
        fileWatcherManager.pauseWatching(workspacePath, windowId);
      }
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_PAUSE_FAILED");
    }
  });

  handleAppIpc("watcher:resume", async (event, expectedWorkspacePath?: string): Promise<IpcResultDTO<void>> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      const workspacePath = resolveExpectedWorkspacePath(expectedWorkspacePath, entry?.workspacePath);
      if (workspacePath && windowId !== undefined) {
        // 旧工作区操作的 finally 只能恢复它自己的计数，不能减少新工作区的暂停计数。
        await fileWatcherManager.resumeWatching(workspacePath, windowId);
      }
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WATCHER_RESUME_FAILED");
    }
  });
}
