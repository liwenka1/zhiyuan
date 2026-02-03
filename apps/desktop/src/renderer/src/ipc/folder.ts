/**
 * Folder IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const folderIpc = {
  create: async (folderPath: string) => unwrapIpcResult(await window.api.folder.create(folderPath)),

  delete: async (folderPath: string) => unwrapIpcResult(await window.api.folder.delete(folderPath)),

  rename: async (oldPath: string, newPath: string) => unwrapIpcResult(await window.api.folder.rename(oldPath, newPath)),

  // 事件监听不需要 unwrap，直接透传
  onAdded: window.api.folder.onAdded,
  onDeleted: window.api.folder.onDeleted
};
