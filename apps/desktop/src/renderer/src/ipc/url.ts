/**
 * URL IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const urlIpc = {
  createNote: async (url: string, workspacePath: string, folderId?: string) =>
    unwrapIpcResult(await window.api.url.createNote(url, workspacePath, folderId))
};
