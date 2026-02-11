/**
 * 导出布局配置（跨进程共享）
 * 仅定义数据模型与归一化逻辑，不包含具体 UI 行为。
 */

export interface ExportLayoutConfig {
  /** 外层背景色（导出页面画布） */
  outerBackground: string;
  /** 内容卡片背景色 */
  innerBackground: string;
  /** 内容最大宽度（px） */
  contentWidth: number;
  /** 卡片内边距（px） */
  cardPadding: number;
  /** 基础字号（px） */
  baseFontSize: number;
}

export const DEFAULT_EXPORT_LAYOUT_CONFIG: ExportLayoutConfig = {
  outerBackground: "#f5f5f5",
  innerBackground: "#ffffff",
  contentWidth: 800,
  cardPadding: 24,
  baseFontSize: 16
};

function toValidColor(input: unknown, fallback: string): string {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  return value.length > 0 ? value : fallback;
}

function toBoundedNumber(input: unknown, fallback: number, min: number, max: number): number {
  if (typeof input !== "number" || Number.isNaN(input)) return fallback;
  return Math.min(max, Math.max(min, Math.round(input)));
}

/**
 * 归一化导出布局配置：
 * - 缺失值回退默认
 * - 数值做范围约束，防止异常值导致布局崩坏
 */
export function normalizeExportLayoutConfig(input?: Partial<ExportLayoutConfig> | null): ExportLayoutConfig {
  const source = input ?? {};
  return {
    outerBackground: toValidColor(source.outerBackground, DEFAULT_EXPORT_LAYOUT_CONFIG.outerBackground),
    innerBackground: toValidColor(source.innerBackground, DEFAULT_EXPORT_LAYOUT_CONFIG.innerBackground),
    contentWidth: toBoundedNumber(source.contentWidth, DEFAULT_EXPORT_LAYOUT_CONFIG.contentWidth, 320, 1600),
    cardPadding: toBoundedNumber(source.cardPadding, DEFAULT_EXPORT_LAYOUT_CONFIG.cardPadding, 0, 96),
    baseFontSize: toBoundedNumber(source.baseFontSize, DEFAULT_EXPORT_LAYOUT_CONFIG.baseFontSize, 12, 24)
  };
}
