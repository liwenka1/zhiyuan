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
 * 主题颜色配置
 * 作为 CSS 变量的语义映射表
 */
export const ThemeColors = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
  selection: "--selection",
  divider: "--divider",
  tertiaryForeground: "--tertiary-foreground",
  link: "--link",
  highlight: "--highlight",
  editorTitle: "--editor-title",
  editorLink: "--editor-link",
  editorList: "--editor-list"
} as const;
