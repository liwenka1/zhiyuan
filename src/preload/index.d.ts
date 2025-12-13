import { ElectronAPI } from "@electron-toolkit/preload";
import type { Theme } from "@shared";

// 主题 API 接口
export interface ThemeAPI {
  /**
   * 获取当前主题
   */
  get: () => Promise<Theme>;

  /**
   * 设置主题
   */
  set: (theme: Theme) => Promise<void>;

  /**
   * 监听主题变化（系统主题或用户设置变化）
   * @returns 取消监听函数
   */
  onChanged: (callback: (theme: Theme) => void) => () => void;
}

// 扩展的 API 接口
export interface API {
  theme: ThemeAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}
