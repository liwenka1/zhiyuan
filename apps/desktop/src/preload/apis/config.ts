import { ipcRenderer } from "electron";
import type { ExportLayoutConfig, GitHubConfig, GitHubProjectConfigMap, IpcResultDTO, ShortcutConfig } from "@shared";

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
   * 获取快捷键配置
   */
  getShortcuts: (): Promise<IpcResultDTO<ShortcutConfig>> => ipcRenderer.invoke("config:getShortcuts"),

  /**
   * 设置快捷键配置（全量覆盖）
   */
  setShortcuts: (shortcuts: ShortcutConfig): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setShortcuts", shortcuts),

  /**
   * 获取 GitHub 配置
   */
  getGitHubProjectConfigs: (): Promise<
    IpcResultDTO<{ projectConfigs: GitHubProjectConfigMap; defaultProjectKey: string }>
  > => ipcRenderer.invoke("config:getGitHubProjectConfigs"),

  getGitHubConfig: (projectKey?: string): Promise<IpcResultDTO<GitHubConfig>> =>
    ipcRenderer.invoke("config:getGitHubConfig", projectKey),

  /**
   * 设置 GitHub 配置
   */
  setGitHubConfig: (config: GitHubConfig, projectKey?: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setGitHubConfig", config, projectKey),

  /**
   * 设置 GitHub 默认项目键
   */
  setGitHubDefaultProjectKey: (projectKey: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setGitHubDefaultProjectKey", projectKey),

  /**
   * 删除 GitHub 项目配置
   */
  removeGitHubProjectConfig: (projectKey: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:removeGitHubProjectConfig", projectKey)
};
