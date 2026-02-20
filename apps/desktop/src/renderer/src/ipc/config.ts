/**
 * Config IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import type { ExportLayoutConfig, GitHubConfig, ShortcutConfig } from "@shared";

export const configIpc = {
  getPinnedNotes: async (workspacePath: string) =>
    unwrapIpcResult(await window.api.config.getPinnedNotes(workspacePath)),

  setPinnedNotes: async (workspacePath: string, noteIds: string[]) =>
    unwrapIpcResult(await window.api.config.setPinnedNotes(workspacePath, noteIds)),

  getExportThemeId: async () => unwrapIpcResult(await window.api.config.getExportThemeId()),

  setExportThemeId: async (themeId: string) => unwrapIpcResult(await window.api.config.setExportThemeId(themeId)),

  getExportLayout: async () => unwrapIpcResult(await window.api.config.getExportLayout()),

  setExportLayout: async (patch: Partial<ExportLayoutConfig>) =>
    unwrapIpcResult(await window.api.config.setExportLayout(patch)),

  getShortcuts: async () => unwrapIpcResult(await window.api.config.getShortcuts()),

  setShortcuts: async (shortcuts: ShortcutConfig) => unwrapIpcResult(await window.api.config.setShortcuts(shortcuts)),

  getGitHubConfig: async (): Promise<GitHubConfig> => unwrapIpcResult(await window.api.config.getGitHubConfig()),

  setGitHubConfig: async (config: GitHubConfig) => unwrapIpcResult(await window.api.config.setGitHubConfig(config))
};
