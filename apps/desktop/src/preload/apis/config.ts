import { ipcRenderer } from "electron";
import type {
  ExportLayoutConfig,
  GitHubConfig,
  GitHubProjectConfigMap,
  IpcResultDTO,
  ShortcutBinding,
  ShortcutConfig,
  ShortcutId
} from "@shared";

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

  setShortcut: (id: ShortcutId, binding: ShortcutBinding): Promise<IpcResultDTO<ShortcutConfig>> =>
    ipcRenderer.invoke("config:setShortcut", id, binding),

  onShortcutsChanged: (callback: (config: ShortcutConfig) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: ShortcutConfig) => callback(config);
    ipcRenderer.on("config:shortcutsChanged", listener);
    return () => ipcRenderer.removeListener("config:shortcutsChanged", listener);
  },

  /**
   * 获取 GitHub 配置
   */
  getGitHubProjectConfigs: (): Promise<
    IpcResultDTO<{ projectConfigs: GitHubProjectConfigMap; activeProjectKey: string }>
  > => ipcRenderer.invoke("config:getGitHubProjectConfigs"),

  getGitHubConfig: (projectKey?: string): Promise<IpcResultDTO<GitHubConfig>> =>
    ipcRenderer.invoke("config:getGitHubConfig", projectKey),

  /**
   * 设置 GitHub 配置
   */
  setGitHubConfig: (config: GitHubConfig, projectKey?: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setGitHubConfig", config, projectKey),

  /**
   * 设置 GitHub 当前选中的项目键
   */
  setGitHubActiveProjectKey: (projectKey: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:setGitHubActiveProjectKey", projectKey),

  /**
   * 删除 GitHub 项目配置
   */
  removeGitHubProjectConfig: (projectKey: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("config:removeGitHubProjectConfig", projectKey)
};
