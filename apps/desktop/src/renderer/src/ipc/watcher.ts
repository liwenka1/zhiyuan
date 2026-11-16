/**
 * Watcher IPC wrapper
 */

import { safeUnwrapIpcResult } from "@/lib/ipc-utils";

// watcher 使用 safeUnwrap，失败只记录日志不中断流程
export const watcherIpc = {
  pause: async (expectedWorkspacePath?: string) => {
    safeUnwrapIpcResult(await window.api.watcher.pause(expectedWorkspacePath));
  },

  resume: async (expectedWorkspacePath?: string) => {
    safeUnwrapIpcResult(await window.api.watcher.resume(expectedWorkspacePath));
  }
};
