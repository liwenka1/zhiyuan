/**
 * 颜色工具函数
 * 提供颜色解析与明暗判断等通用能力
 */

/**
 * 将 hex / rgb() / rgba() 颜色字符串解析为 RGB 值
 * 支持逗号分隔 rgb(r, g, b) 和现代空格分隔 rgb(r g b / alpha) 语法
 * 返回 null 表示无法解析
 */
export function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const value = color.trim().toLowerCase();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? null : { r, g, b };
    }
    return null;
  }

  // 逗号分隔：rgb(r, g, b) / rgba(r, g, b, a)
  const commaMatch = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+\s*)?\)$/);
  if (commaMatch) {
    return toSafeRgb(Number(commaMatch[1]), Number(commaMatch[2]), Number(commaMatch[3]));
  }

  // 空格分隔（现代语法）：rgb(r g b) / rgb(r g b / alpha)
  const spaceMatch = value.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+\s*)?\)$/);
  if (spaceMatch) {
    return toSafeRgb(Number(spaceMatch[1]), Number(spaceMatch[2]), Number(spaceMatch[3]));
  }

  return null;
}

/** 将 r/g/b 数值安全地转为 RGB 对象，任一 NaN 则返回 null */
function toSafeRgb(r: number, g: number, b: number) {
  if ([r, g, b].some((c) => Number.isNaN(c))) return null;
  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b))
  };
}

/**
 * 判断颜色是否为深色（基于相对亮度）
 * 返回 null 表示颜色无法解析
 */
export function isDarkColor(color: string): boolean | null {
  const rgb = parseRgb(color);
  if (!rgb) return null;
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.5;
}
