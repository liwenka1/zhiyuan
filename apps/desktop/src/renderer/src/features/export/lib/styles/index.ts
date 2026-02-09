/**
 * 导出样式模块统一入口
 * 用于生成各种格式导出时所需的样式
 */

// 字体配置
export { FONT_FILES, generateFontFaces, generateEmbeddedFontFaces } from "./font-config";

// 主题颜色
export { type ThemeColors, type ThemeColorsInput, type ExportThemePreset, buildThemeColors } from "./theme-colors";

// 主题预设 & 查找函数
export {
  EXPORT_THEME_PRESETS,
  type ExportThemeId,
  DEFAULT_EXPORT_THEME_ID,
  resolveExportThemeId,
  getExportThemeColors
} from "./themes";

// Prose 样式（HTML/PDF/图片导出）
export { generateProseStyles } from "./prose-styles";

// 微信公众号样式
export { generateWechatStyles } from "./wechat-styles";
