import type { Theme } from "@shared";

const THEME_COLORS = {
  light: {
    background: "#FFFFFF",
    foreground: "#3B3B3B"
  },
  dark: {
    background: "#1F1F1F",
    foreground: "#CCCCCC"
  }
} as const;

export function getThemeBackgroundColor(theme: Theme): string {
  return THEME_COLORS[theme].background;
}

export function getThemeForegroundColor(theme: Theme): string {
  return THEME_COLORS[theme].foreground;
}
