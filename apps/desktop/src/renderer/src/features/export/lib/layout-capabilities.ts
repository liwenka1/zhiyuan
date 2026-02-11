/**
 * 导出布局能力映射
 *
 * 作用：
 * - 统一声明不同导出格式（微信/HTML/PDF/图片）对布局字段的支持情况
 * - 供设置页提示与导出应用逻辑复用，避免规则分散导致不一致
 */

export const EXPORT_TARGET_FORMATS = ["wechat", "html", "pdf", "image"] as const;
export type ExportTargetFormat = (typeof EXPORT_TARGET_FORMATS)[number];

export const EXPORT_LAYOUT_FIELDS = [
  "outerBackground",
  "innerBackground",
  "contentWidth",
  "cardPadding",
  "baseFontSize"
] as const;
export type ExportLayoutField = (typeof EXPORT_LAYOUT_FIELDS)[number];

type LayoutCapabilityMap = Record<ExportLayoutField, Record<ExportTargetFormat, boolean>>;

export const EXPORT_LAYOUT_CAPABILITY_MAP: LayoutCapabilityMap = {
  // 微信正文区域背景/容器布局由平台控制，应用侧无法稳定覆盖
  outerBackground: { wechat: false, html: true, pdf: true, image: true },
  innerBackground: { wechat: false, html: true, pdf: true, image: true },
  contentWidth: { wechat: false, html: true, pdf: true, image: true },
  cardPadding: { wechat: false, html: true, pdf: true, image: true },
  // 字号可映射到正文基础字体尺寸，微信可生效
  baseFontSize: { wechat: true, html: true, pdf: true, image: true }
};

export function isLayoutFieldSupported(format: ExportTargetFormat, field: ExportLayoutField): boolean {
  return EXPORT_LAYOUT_CAPABILITY_MAP[field][format];
}

export function getUnsupportedLayoutFieldsForFormat(format: ExportTargetFormat): ExportLayoutField[] {
  return EXPORT_LAYOUT_FIELDS.filter((field) => !isLayoutFieldSupported(format, field));
}

export function getSupportedLayoutFieldsForFormat(format: ExportTargetFormat): ExportLayoutField[] {
  return EXPORT_LAYOUT_FIELDS.filter((field) => isLayoutFieldSupported(format, field));
}

export function pickSupportedLayoutFieldsForFormat<T extends Partial<Record<ExportLayoutField, unknown>>>(
  format: ExportTargetFormat,
  layout: T
): Partial<T> {
  const next: Partial<T> = {};
  for (const field of EXPORT_LAYOUT_FIELDS) {
    if (isLayoutFieldSupported(format, field) && field in layout) {
      next[field as keyof T] = layout[field as keyof T];
    }
  }
  return next;
}
