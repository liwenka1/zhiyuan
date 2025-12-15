import Store from "electron-store";

interface AppConfig {
  workspacePath: string | null;
  recentWorkspaces: string[];
}

// 创建配置存储实例
const store = new Store<AppConfig>({
  defaults: {
    workspacePath: null,
    recentWorkspaces: []
  }
});

/**
 * 配置管理器
 */
export const configManager = {
  /**
   * 获取当前工作区路径
   */
  getWorkspacePath(): string | null {
    return store.get("workspacePath");
  },

  /**
   * 设置当前工作区路径
   */
  setWorkspacePath(path: string | null): void {
    store.set("workspacePath", path);

    // 如果设置了新路径，添加到最近打开列表
    if (path) {
      this.addRecentWorkspace(path);
    }
  },

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
  }
};
