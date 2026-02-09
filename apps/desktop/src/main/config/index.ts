import Store from "electron-store";
import type { ThemeMode } from "@shared";

interface AppConfig {
  recentWorkspaces: string[];
  pinnedNotes: Record<string, string[]>;
  theme: ThemeMode; // 主题模式（light/dark/system）
  exportThemeId: string; // 导出主题预设 ID
}

// 创建配置存储实例
const store = new Store<AppConfig>({
  defaults: {
    recentWorkspaces: [],
    pinnedNotes: {},
    theme: "system", // 默认跟随系统
    exportThemeId: "default" // 默认导出主题
  }
});

/**
 * 配置管理器
 *
 * 注意：workspacePath 不再持久化到配置中。
 * 每个窗口的工作区路径由 WindowManager 在内存中管理。
 */
export const configManager = {
  /**
   * 获取最近打开的工作区列表
   */
  getRecentWorkspaces(): string[] {
    return store.get("recentWorkspaces");
  },

  /**
   * 添加到最近打开列表
   */
  addRecentWorkspace(path: string): void {
    const recent = store.get("recentWorkspaces");
    // 移除重复项
    const filtered = recent.filter((p) => p !== path);
    // 添加到开头，最多保留 10 个
    const updated = [path, ...filtered].slice(0, 10);
    store.set("recentWorkspaces", updated);
  },

  /**
   * 清空配置
   */
  clear(): void {
    store.clear();
  },

  /**
   * 获取工作区的置顶笔记列表
   */
  getPinnedNotes(workspacePath: string): string[] {
    const pinnedNotes = store.get("pinnedNotes");
    return pinnedNotes[workspacePath] || [];
  },

  /**
   * 设置工作区的置顶笔记列表
   */
  setPinnedNotes(workspacePath: string, noteIds: string[]): void {
    const pinnedNotes = store.get("pinnedNotes");
    pinnedNotes[workspacePath] = noteIds;
    store.set("pinnedNotes", pinnedNotes);
  },

  /**
   * 获取用户设置的主题偏好
   * @returns ThemeMode
   */
  getTheme(): ThemeMode {
    const theme = store.get("theme");
    // 校验值是否合法，防止配置文件损坏或被手动修改为非法值
    const validThemes: ThemeMode[] = ["light", "dark", "system"];
    if (theme && validThemes.includes(theme)) {
      return theme;
    }
    return "system";
  },

  /**
   * 设置用户主题偏好
   * @param theme ThemeMode
   */
  setTheme(theme: ThemeMode): void {
    store.set("theme", theme);
  },

  /**
   * 获取导出主题预设 ID
   */
  getExportThemeId(): string {
    return store.get("exportThemeId");
  },

  /**
   * 设置导出主题预设 ID
   */
  setExportThemeId(themeId: string): void {
    store.set("exportThemeId", themeId);
  }
};
