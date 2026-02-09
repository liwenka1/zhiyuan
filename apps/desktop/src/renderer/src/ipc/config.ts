/**
 * Config IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const configIpc = {
  getPinnedNotes: async (workspacePath: string) =>
    unwrapIpcResult(await window.api.config.getPinnedNotes(workspacePath)),

  setPinnedNotes: async (workspacePath: string, noteIds: string[]) =>
    unwrapIpcResult(await window.api.config.setPinnedNotes(workspacePath, noteIds)),

  getExportThemeId: async () => unwrapIpcResult(await window.api.config.getExportThemeId()),

  setExportThemeId: async (themeId: string) => unwrapIpcResult(await window.api.config.setExportThemeId(themeId))
};
