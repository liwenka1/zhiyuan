/**
 * Shell IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const shellIpc = {
  showItemInFolder: async (fullPath: string) => unwrapIpcResult(await window.api.shell.showItemInFolder(fullPath)),

  openPath: async (fullPath: string) => unwrapIpcResult(await window.api.shell.openPath(fullPath)),

  openExternal: async (url: string) => unwrapIpcResult(await window.api.shell.openExternal(url))
};
