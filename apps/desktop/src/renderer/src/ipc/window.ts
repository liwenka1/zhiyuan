/**
 * Window IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const windowIpc = {
  setFullScreen: async (fullScreen: boolean) => unwrapIpcResult(await window.api.window.setFullScreen(fullScreen)),

  isFullScreen: async () => unwrapIpcResult(await window.api.window.isFullScreen()),

  newWindow: async () => unwrapIpcResult(await window.api.window.newWindow())
};
