import { ipcRenderer } from "electron";
import type { ExportLayoutConfig, IpcResultDTO } from "@shared";

export const configApi = {
  /**
   * 获取工作区的置顶笔记列表
   */
  getPinnedNotes: (workspacePath: string): Promise<IpcResultDTO<string[]>> =>
    ipcRenderer.invoke("config:getPinnedNotes", workspacePath),

  /**
   * 设置工作区的置顶笔记列表
   */
  setPinnedNotes: (workspacePath: string, noteIds: string[]): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setPinnedNotes", workspacePath, noteIds),

  /**
   * 获取导出主题预设 ID
   */
  getExportThemeId: (): Promise<IpcResultDTO<string>> => ipcRenderer.invoke("config:getExportThemeId"),

  /**
   * 设置导出主题预设 ID
   */
  setExportThemeId: (themeId: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setExportThemeId", themeId),

  /**
   * 获取导出布局配置
   */
  getExportLayout: (): Promise<IpcResultDTO<ExportLayoutConfig>> => ipcRenderer.invoke("config:getExportLayout"),

  /**
   * 设置导出布局配置（部分更新）
   */
  setExportLayout: (patch: Partial<ExportLayoutConfig>): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setExportLayout", patch),

  /**
   * 获取 GitHub 配置
   */
  getGitHubConfig: (): Promise<IpcResultDTO<{ owner: string; repo: string; token: string }>> =>
    ipcRenderer.invoke("config:getGitHubConfig"),

  /**
   * 设置 GitHub 配置
   */
  setGitHubConfig: (config: { owner: string; repo: string; token: string }): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setGitHubConfig", config)
};
