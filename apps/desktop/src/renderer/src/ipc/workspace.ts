/**
 * Workspace IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const workspaceIpc = {
  select: async (options?: { title?: string; buttonLabel?: string }) =>
    unwrapIpcResult(await window.api.workspace.select(options)),

  openFile: async (options?: { title?: string; buttonLabel?: string }) =>
    unwrapIpcResult(await window.api.workspace.openFile(options)),

  getCurrent: async () => unwrapIpcResult(await window.api.workspace.getCurrent()),

  scan: async (workspacePath: string) => unwrapIpcResult(await window.api.workspace.scan(workspacePath)),

  getRecent: async () => unwrapIpcResult(await window.api.workspace.getRecent()),

  onMenuOpenFolder: window.api.workspace.onMenuOpenFolder,
  onMenuOpenFile: window.api.workspace.onMenuOpenFile,
  onExternalOpen: window.api.workspace.onExternalOpen
};
