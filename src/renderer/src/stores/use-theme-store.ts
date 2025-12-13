import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@shared";

interface ThemeState {
  // 当前主题（light/dark）
  theme: Theme;

  // 设置主题
  setTheme: (theme: Theme) => void;
  // 切换主题
  toggleTheme: () => void;
  // 初始化主题
  initTheme: () => void;
}

// 应用主题到 document
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

// 检查是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== "undefined" && window.api && window.api.theme;
};

// 获取系统主题（浏览器环境的备用方案）
const getSystemTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",

      setTheme: async (theme: Theme) => {
        set({ theme });
        applyThemeToDocument(theme);

        // 如果在 Electron 环境中，同步到主进程
        if (isElectron()) {
          try {
            await window.api.theme.set(theme);
          } catch (error) {
            console.error("Failed to sync theme to main process:", error);
          }
        }
      },

      toggleTheme: () => {
        const newTheme = get().theme === "light" ? "dark" : "light";
        get().setTheme(newTheme);
      },

      initTheme: async () => {
        // 如果在 Electron 环境中，从主进程获取主题
        if (isElectron()) {
          try {
            // 从主进程获取当前主题（主进程会自动处理系统主题）
            const theme = await window.api.theme.get();
            set({ theme });
            applyThemeToDocument(theme);

            // 监听主进程的主题变化（系统主题变化或其他窗口改变主题）
            window.api.theme.onChanged((newTheme) => {
              set({ theme: newTheme });
              applyThemeToDocument(newTheme);
            });
          } catch (error) {
            console.error("Failed to get theme from main process:", error);
            // 出错时回退到本地主题
            const { theme } = get();
            applyThemeToDocument(theme);
          }
        } else {
          // 浏览器环境：使用保存的主题或系统主题
          const { theme } = get();
          const savedTheme = localStorage.getItem("theme-storage");

          if (!savedTheme) {
            const systemTheme = getSystemTheme();
            get().setTheme(systemTheme);
          } else {
            applyThemeToDocument(theme);
          }
        }
      }
    }),
    {
      name: "theme-storage", // localStorage key
      partialize: (state) => ({ theme: state.theme }) // 只持久化 theme
    }
  )
);
