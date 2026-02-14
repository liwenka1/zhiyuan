import type { ExportLayoutConfig } from "@shared";
import type { ExportTargetFormat } from "../layout-capabilities";
import { resolveExportLayoutForFormat } from "../layout-capabilities";
import { isDarkColor } from "@/lib/color-utils";
import { getExportThemeColors, DEFAULT_EXPORT_THEME_ID, generateProseStyles, generateWechatStyles } from "./index";
import type { ThemeColors } from "./theme-colors";

export function buildProseStyleBundle(
  themeId: string,
  format: Extract<ExportTargetFormat, "html" | "pdf" | "image">,
  layout?: Partial<ExportLayoutConfig>
): { colors: ThemeColors; proseStyles: string } {
  const colors = getExportThemeColors(themeId);
  const resolvedLayout = resolveExportLayoutForFormat(format, layout);
  const proseStyles = generateProseStyles(colors, {
    baseFontSize: resolvedLayout.baseFontSize,
    outerBackground: typeof resolvedLayout.outerBackground === "string" ? resolvedLayout.outerBackground : undefined,
    innerBackground: typeof resolvedLayout.innerBackground === "string" ? resolvedLayout.innerBackground : undefined,
    contentWidth: typeof resolvedLayout.contentWidth === "number" ? resolvedLayout.contentWidth : undefined,
    cardPadding: typeof resolvedLayout.cardPadding === "number" ? resolvedLayout.cardPadding : undefined
  });

  return { colors, proseStyles };
}

export function buildWechatStyleBundle(
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): { colors: ThemeColors; styles: string } {
  const colors = getWechatSafeThemeColors(themeId);
  const resolvedLayout = resolveExportLayoutForFormat("wechat", layout);
  const styles = generateWechatStyles(colors, {
    baseFontSize: typeof resolvedLayout.baseFontSize === "number" ? resolvedLayout.baseFontSize : undefined
  });

  return { colors, styles };
}

function getWechatSafeThemeColors(themeId: string): ThemeColors {
  const colors = getExportThemeColors(themeId);
  if (isDarkColor(colors.background)) {
    return getExportThemeColors(DEFAULT_EXPORT_THEME_ID);
  }
  return colors;
}
