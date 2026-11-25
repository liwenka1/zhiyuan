import { BrowserWindow } from "electron";
import { windowManager } from "../window-manager";
import type { WorkspacePathScope } from "./path-validator";

/**
 * 返回 IPC 调用窗口绑定的工作区。
 * 所有会访问用户文件的 handler 都应使用这个上下文，而不是相信 renderer
 * 传入的绝对路径。
 */
export function getCallerWorkspace(event: Electron.IpcMainInvokeEvent): string {
  return getCallerWorkspaceScope(event).workspacePath;
}

export function getCallerWorkspaceScope(event: Electron.IpcMainInvokeEvent): WorkspacePathScope {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("Cannot resolve caller window");
  }

  const entry = windowManager.getEntryById(win.id);
  if (!entry?.workspacePath) {
    throw new Error("No workspace selected");
  }

  return { workspacePath: entry.workspacePath, scannedWorkspacePath: entry.scannedWorkspacePath };
}

export function getCallerWindowId(event: Electron.IpcMainInvokeEvent): number {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("Cannot resolve caller window");
  }
  return win.id;
}

export function getCallerResourceToken(event: Electron.IpcMainInvokeEvent): string {
  const entry = windowManager.getEntryByWebContents(event.sender);
  if (!entry) throw new Error("Cannot resolve caller window");
  return entry.localResourceToken;
}
