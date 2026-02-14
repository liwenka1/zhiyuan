import { ThemeColors } from "@shared";

/**
 * 获取 CSS 变量对应的颜色值
 */
export const getThemeColor = (variable: string): string => {
  return `var(${variable})`;
};

/**
 * 预定义的颜色值（用于 Motion 动画等需要颜色字符串的场景）
 * 注意：使用 rgba(0,0,0,0) 代替 "transparent"，因为 Motion 无法对 "transparent" 进行动画
 */
export const MotionColors = {
  transparent: "rgba(0, 0, 0, 0)",
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
