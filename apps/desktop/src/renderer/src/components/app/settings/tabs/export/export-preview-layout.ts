import type { ExportLayoutConfig } from "@shared";
import type { ThemeColors } from "@/features/export/lib/styles";

export interface ExportPreviewLayoutTokens {
  baseFontSize: number;
  contentWidth: number;
  cardPadding: number;
  outerBackground: string;
  innerBackground: string;
}

/**
 * 预览布局参数计算（仅用于设置面板预览）
 * 保持与导出参数一致，但会做轻量缩放，避免预览卡超出容器。
 */
export function buildExportPreviewLayout(
  colors: ThemeColors,
  layout?: Partial<ExportLayoutConfig>
): ExportPreviewLayoutTokens {
  const previewScale = 0.72;
  return {
    baseFontSize: Math.round((layout?.baseFontSize ?? 16) * previewScale * 10) / 10,
    contentWidth: layout?.contentWidth ?? 800,
    cardPadding: Math.max(8, Math.round((layout?.cardPadding ?? 24) * 0.55)),
    outerBackground: layout?.outerBackground ?? "#f5f5f5",
    innerBackground: layout?.innerBackground ?? colors.background
  };
}
