/**
 * File IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const fileIpc = {
  read: async (filePath: string) => unwrapIpcResult(await window.api.file.read(filePath)),

  write: async (filePath: string, content: string) => unwrapIpcResult(await window.api.file.write(filePath, content)),

  create: async (filePath: string, content: string) => unwrapIpcResult(await window.api.file.create(filePath, content)),

  delete: async (filePath: string) => unwrapIpcResult(await window.api.file.delete(filePath)),

  rename: async (oldPath: string, newPath: string) => unwrapIpcResult(await window.api.file.rename(oldPath, newPath)),

  copy: async (sourcePath: string, destPath: string) => unwrapIpcResult(await window.api.file.copy(sourcePath, destPath)),

  // 事件监听不需要 unwrap，直接透传
  onChanged: window.api.file.onChanged,
  onAdded: window.api.file.onAdded,
  onDeleted: window.api.file.onDeleted
};
