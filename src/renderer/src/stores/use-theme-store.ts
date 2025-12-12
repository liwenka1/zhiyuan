import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

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

// 获取系统主题
const getSystemTheme = (): Theme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// 应用主题到 document
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",

      setTheme: (theme: Theme) => {
        set({ theme });
        applyThemeToDocument(theme);
      },

      toggleTheme: () => {
        const newTheme = get().theme === "light" ? "dark" : "light";
        get().setTheme(newTheme);
      },

      initTheme: () => {
        // 如果是第一次访问（没有保存的主题），使用系统主题
        const { theme } = get();

        // 如果 localStorage 中没有保存主题，则使用系统主题
        const savedTheme = localStorage.getItem("theme-storage");
        if (!savedTheme) {
          const systemTheme = getSystemTheme();
          get().setTheme(systemTheme);
        } else {
          // 否则应用已保存的主题
          applyThemeToDocument(theme);
        }
      }
    }),
    {
      name: "theme-storage", // localStorage key
      partialize: (state) => ({ theme: state.theme }) // 只持久化 theme
    }
  )
);
