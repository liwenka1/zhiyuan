/**
 * Watcher IPC wrapper
 */

import { safeUnwrapIpcResult } from "@/lib/ipc-utils";

// watcher 使用 safeUnwrap，失败只记录日志不中断流程
export const watcherIpc = {
  pause: async () => {
    safeUnwrapIpcResult(await window.api.watcher.pause());
  },

  resume: async () => {
    safeUnwrapIpcResult(await window.api.watcher.resume());
  }
};
