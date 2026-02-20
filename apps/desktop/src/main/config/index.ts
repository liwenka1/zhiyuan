import Store from "electron-store";
import {
  DEFAULT_EXPORT_LAYOUT_CONFIG,
  normalizeExportLayoutConfig,
  type ExportLayoutConfig,
  type ThemeMode,
  DEFAULT_SHORTCUTS,
  type ShortcutConfig
} from "@shared";

interface AppConfig {
  recentWorkspaces: string[];
  pinnedNotes: Record<string, string[]>;
  theme: ThemeMode; // 主题模式（light/dark/system）
  exportThemeId: string; // 导出主题预设 ID
  exportLayout: ExportLayoutConfig; // 导出布局配置
  shortcuts: ShortcutConfig; // 快捷键配置
  github: {
    owner: string;
    repo: string;
    token: string;
  };
}

// 创建配置存储实例
const store = new Store<AppConfig>({
  defaults: {
    recentWorkspaces: [],
    pinnedNotes: {},
    theme: "system", // 默认跟随系统
    exportThemeId: "default", // 默认导出主题
    exportLayout: DEFAULT_EXPORT_LAYOUT_CONFIG, // 默认导出布局
    shortcuts: DEFAULT_SHORTCUTS,
    github: {
      owner: "",
      repo: "",
      token: ""
    }
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
  },

  /**
   * 获取导出布局配置
   */
  getExportLayout(): ExportLayoutConfig {
    return normalizeExportLayoutConfig(store.get("exportLayout"));
  },

  /**
   * 设置导出布局配置（支持部分更新）
   */
  setExportLayout(patch: Partial<ExportLayoutConfig>): void {
    const current = normalizeExportLayoutConfig(store.get("exportLayout"));
    const next = normalizeExportLayoutConfig({ ...current, ...patch });
    store.set("exportLayout", next);
  },

  /**
   * 获取快捷键配置
   */
  getShortcuts(): ShortcutConfig {
    const saved = store.get("shortcuts");
    return { ...DEFAULT_SHORTCUTS, ...saved };
  },

  /**
   * 设置快捷键配置（全量覆盖）
   */
  setShortcuts(next: ShortcutConfig): void {
    store.set("shortcuts", next);
  },

  /**
   * 获取 GitHub 配置
   */
  getGitHubConfig(): { owner: string; repo: string; token: string } {
    return store.get("github");
  },

  /**
   * 设置 GitHub 配置
   */
  setGitHubConfig(config: { owner: string; repo: string; token: string }): void {
    store.set("github", {
      owner: config.owner || "",
      repo: config.repo || "",
      token: config.token || ""
    });
  }
};
