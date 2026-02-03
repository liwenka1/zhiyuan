/**
 * 共享类型定义
 * 供主进程、渲染进程和 preload 使用
 */

/**
 * 应用主题：只有浅色和深色两种
 */
export type Theme = "light" | "dark";

/**
 * 主题模式：支持跟随系统
 */
export type ThemeMode = Theme | "system";

/**
 * HSL 转 Hex 颜色
 * @param h 色相 (0-360)
 * @param s 饱和度 (0-100)
 * @param l 亮度 (0-100)
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number): string => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * 主题颜色配置
 * 这些值需要与 variables.css 中的 CSS 变量保持一致
 */
export const ThemeColors = {
  light: {
    background: hslToHex(0, 0, 100),
    foreground: hslToHex(210, 12, 16)
  },
  dark: {
    background: hslToHex(220, 13, 18),
    foreground: hslToHex(218, 11, 80)
  }
} as const;

/**
 * 根据主题获取背景色
 */
export function getThemeBackgroundColor(theme: Theme): string {
  return ThemeColors[theme].background;
}

/**
 * 根据主题获取前景色（用于标题栏符号颜色等）
 */
export function getThemeForegroundColor(theme: Theme): string {
  return ThemeColors[theme].foreground;
}
