import { create } from "zustand";
import type { Theme, ThemeMode } from "@shared";
import { themeIpc } from "@/ipc";

interface ThemeState {
  /** 当前实际生效的主题（light / dark） */
  theme: Theme;
  /** 用户选择的主题模式（light / dark / system） */
  themeMode: ThemeMode;

  /** 设置主题模式（同步到主进程） */
  setTheme: (mode: ThemeMode) => Promise<void>;
  /** 切换主题（仅在 light/dark 之间切换，不含 system） */
  toggleTheme: () => void;
  /** 初始化主题（异步从主进程获取） */
  initTheme: () => Promise<void>;
  /** 清理资源 */
  cleanup: () => void;
}

// 保存取消监听函数
let unsubscribeThemeChange: (() => void) | null = null;

// 应用主题到 document
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// 获取系统主题（浏览器环境的备用方案）
const getSystemTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/**
 * 主题 Store
 *
 * 架构说明：
 * - 主进程负责：持久化主题偏好（electron-store）、管理系统主题监听
 * - 渲染进程负责：显示主题、响应用户操作
 * - 单一数据源：主进程的 ThemeManager
 *
 * 时序：
 * 1. 主进程启动 -> ThemeManager.init() -> 从 electron-store 读取用户偏好
 * 2. 创建窗口 -> 使用正确的背景色（无白色闪烁）
 * 3. 渲染进程加载 -> initTheme() -> 从主进程获取当前主题 + 模式
 * 4. 用户切换主题 -> setTheme() -> 同步到主进程 -> 主进程持久化 + 通知所有窗口
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",
  themeMode: "system",

  setTheme: async (mode: ThemeMode) => {
    // 1. 立即更新本地状态（响应快）
    // 预测实际主题：system 模式使用系统主题，否则直接使用指定值
    const resolvedTheme: Theme = mode === "system" ? getSystemTheme() : mode;
    set({ themeMode: mode, theme: resolvedTheme });
    applyThemeToDocument(resolvedTheme);

    // 2. 同步到主进程（持久化 + 通知其他窗口）
    await themeIpc.set(mode).catch(() => {});
  },

  toggleTheme: () => {
    const newTheme = get().theme === "light" ? "dark" : "light";
    get().setTheme(newTheme);
  },

  initTheme: async () => {
    try {
      // 先清理旧的监听器（防止重复监听）
      unsubscribeThemeChange?.();

      // 从主进程获取当前主题和模式
      const [theme, themeMode] = await Promise.all([themeIpc.get(), themeIpc.getMode()]);

      // 更新状态并应用到 document
      set({ theme, themeMode });
      applyThemeToDocument(theme);

      // 监听主进程的主题变化
      // 触发场景：
      // - 系统主题变化（且用户没有手动设置固定主题）
      // - 其他窗口修改了主题
      unsubscribeThemeChange = themeIpc.onChanged((newTheme) => {
        set({ theme: newTheme });
        applyThemeToDocument(newTheme);
      });
    } catch {
      // 出错时回退到系统主题
      const systemTheme = getSystemTheme();
      set({ theme: systemTheme, themeMode: "system" });
      applyThemeToDocument(systemTheme);
    }
  },

  cleanup: () => {
    // 清理监听器
    unsubscribeThemeChange?.();
    unsubscribeThemeChange = null;
  }
}));
