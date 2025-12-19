import { nativeTheme, BrowserWindow } from "electron";
import type { Theme } from "@shared";

/**
 * 主题管理器
 * 负责管理应用主题和监听系统主题变化
 */
class ThemeManager {
  private currentTheme: Theme | null = null;

  /**
   * 初始化主题管理器
   */
  init(): void {
    // 如果没有设置过主题，从系统获取
    if (this.currentTheme === null) {
      this.currentTheme = this.getSystemTheme();
    }

    // 监听系统主题变化
    nativeTheme.on("updated", () => {
      this.notifyThemeChange();
    });
  }

  /**
   * 获取系统主题
   */
  private getSystemTheme(): Theme {
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  }

  /**
   * 获取当前主题
   */
  getTheme(): Theme {
    return this.currentTheme || this.getSystemTheme();
  }

  /**
   * 设置主题
   */
  setTheme(theme: Theme): void {
    this.currentTheme = theme;

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
      // 更新窗口背景色
      const bgColor = currentTheme === "dark" ? "#232931" : "#FFFFFF";
      window.setBackgroundColor(bgColor);

      // 通知渲染进程主题已变化
      window.webContents.send("theme:changed", currentTheme);
    });
  }
}

// 导出单例
export const themeManager = new ThemeManager();
