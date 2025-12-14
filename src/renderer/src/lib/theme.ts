/**
 * 主题颜色配置
 * 用于组件中需要动态访问颜色值的场景
 *
 * 注意：这些颜色值需要与 variables.css 中的定义保持一致
 */

/**
 * 获取 CSS 变量对应的 HSL 颜色值
 */
export const getThemeColor = (variable: string): string => {
  return `hsl(var(${variable}))`;
};

/**
 * 主题颜色变量名
 */
export const ThemeColors = {
  // 基础颜色
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  popover: "--popover",
  popoverForeground: "--popover-foreground",

  // 交互颜色
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

  // 边框和输入
  border: "--border",
  input: "--input",
  ring: "--ring",

  // 扩展颜色
  selection: "--selection",
  divider: "--divider",
  tertiaryForeground: "--tertiary-foreground",
  link: "--link",
  highlight: "--highlight",

  // 新增：语义化颜色变量
  // 编辑器专用颜色
  editorTitle: "--editor-title",
  editorLink: "--editor-link",
  editorList: "--editor-list",

  // 预览专用颜色
  previewTitle: "--preview-title",
  previewLink: "--preview-link",
  previewList: "--preview-list",
  previewCodeBg: "--preview-code-bg"
} as const;

/**
 * 预定义的颜色值（用于 Motion 动画等需要颜色字符串的场景）
 */
export const MotionColors = {
  transparent: "transparent",
  selection: () => getThemeColor(ThemeColors.selection),
  muted: () => getThemeColor(ThemeColors.muted),
  background: () => getThemeColor(ThemeColors.background),
  foreground: () => getThemeColor(ThemeColors.foreground),
  highlight: () => getThemeColor(ThemeColors.highlight),
  divider: () => getThemeColor(ThemeColors.divider)
} as const;

/**
 * 获取选中状态的背景色
 */
export const getSelectionBgColor = (isSelected: boolean) => {
  return isSelected ? MotionColors.selection() : MotionColors.transparent;
};

/**
 * 获取 hover 状态的背景色
 */
export const getHoverBgColor = (isSelected: boolean) => {
  return isSelected ? MotionColors.selection() : MotionColors.muted();
};
