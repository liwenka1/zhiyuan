/**
 * RSS IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const rssIpc = {
  import: async (url: string, workspacePath: string) => unwrapIpcResult(await window.api.rss.import(url, workspacePath)),

  update: async (folderPath: string) => unwrapIpcResult(await window.api.rss.update(folderPath)),

  unsubscribe: async (folderPath: string) => unwrapIpcResult(await window.api.rss.unsubscribe(folderPath))
};
