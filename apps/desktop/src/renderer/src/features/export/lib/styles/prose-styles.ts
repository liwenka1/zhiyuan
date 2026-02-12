/**
 * Prose 样式生成器
 * 用于 HTML/PDF/图片导出，生成 Tailwind Typography prose 样式
 * 与预览组件使用的 prose 类保持一致
 */

import type { ThemeColors } from "./theme-colors";
import { generateProseLayoutStyles } from "./prose-layout-styles";
import { generateProseTypographyStyles } from "./prose-typography-styles";

/**
 * 生成 Tailwind Typography prose 样式
 * 与预览组件使用的 prose 类保持一致
 */
export function generateProseStyles(
  colors: ThemeColors,
  options?: {
    baseFontSize?: number;
    outerBackground?: string;
    innerBackground?: string;
    contentWidth?: number;
    cardPadding?: number;
  }
): string {
  const baseFontSize = options?.baseFontSize ?? 16;
  const outerBackground = options?.outerBackground ?? colors.background;
  const innerBackground = options?.innerBackground ?? colors.background;
  const contentWidth = options?.contentWidth ?? 900;
  const cardPadding = options?.cardPadding ?? 0;
  return `${generateProseLayoutStyles({
    baseFontSize,
    outerBackground,
    innerBackground,
    contentWidth,
    cardPadding
  })}
${generateProseTypographyStyles(colors)}`;
}
