import { nativeTheme, BrowserWindow } from "electron";
import type { Theme, ThemeMode } from "@shared";
import { getThemeBackgroundColor, getThemeForegroundColor } from "@shared";
import { configManager } from "../config";

/**
 * 主题管理器
 * 负责管理应用主题和监听系统主题变化
 *
 * 主题状态：
 * - "system": 跟随系统（默认）
 * - "light": 固定亮色主题
 * - "dark": 固定暗色主题
 */
class ThemeManager {
  /**
   * 初始化主题管理器
   * 从持久化存储中读取用户的主题偏好
   */
  init(): void {
    // 从持久化存储读取用户设置的主题
    const savedTheme = configManager.getTheme();

    // 设置 Electron 原生主题来源
    nativeTheme.themeSource = savedTheme;

    // 监听系统主题变化
    // 只有在"跟随系统"模式下才需要通知渲染进程
    // 固定主题时，即使系统主题变化也不需要响应
    nativeTheme.on("updated", () => {
      if (configManager.getTheme() === "system") {
        this.notifyThemeChange();
      }
    });
  }

  /**
   * 获取系统主题
   */
  private getSystemTheme(): Theme {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  }

  /**
   * 获取当前实际生效的主题
   * 如果用户设置了固定主题，返回用户设置的主题
   * 否则返回系统主题
   */
  getTheme(): Theme {
    const savedTheme = configManager.getTheme();
    return savedTheme === "system" ? this.getSystemTheme() : savedTheme;
  }

  /**
   * 获取用户设置的主题模式（light / dark / system）
   */
  getMode(): ThemeMode {
    return configManager.getTheme();
  }

  /**
   * 设置主题
   * @param theme ThemeMode
   */
  setTheme(theme: ThemeMode): void {
    // 持久化用户的选择
    configManager.setTheme(theme);

    // 更新 Electron 原生主题
    nativeTheme.themeSource = theme;

    // 通知所有窗口主题已更改
    this.notifyThemeChange();
  }

  /**
   * 通知所有窗口主题变化
   */
  private notifyThemeChange(): void {
    const currentTheme = this.getTheme();
    const windows = BrowserWindow.getAllWindows();

    windows.forEach((window) => {
      // 更新窗口背景色（使用共享的主题颜色配置）
      const bgColor = getThemeBackgroundColor(currentTheme);
      window.setBackgroundColor(bgColor);

      // Windows: 更新标题栏颜色
      if (process.platform === "win32") {
        window.setTitleBarOverlay({
          color: bgColor,
          symbolColor: getThemeForegroundColor(currentTheme)
        });
      }

      // 通知渲染进程主题已变化
      window.webContents.send("theme:changed", currentTheme);
    });
  }
}

// 导出单例
export const themeManager = new ThemeManager();
