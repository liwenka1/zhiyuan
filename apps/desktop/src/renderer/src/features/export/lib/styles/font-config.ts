/**
 * 字体配置
 * 已迁移至使用系统默认字体，无需加载自定义字体文件
 */

/**
 * 系统字体栈 - 用于导出功能
 * 无需实际字体文件，直接使用系统默认字体
 */
export const SYSTEM_FONT_STACK = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
  mono: '"SF Mono", Monaco, Consolas, "Courier New", monospace'
} as const;

/**
 * 生成 @font-face 声明
 * 已弃用：现在使用系统字体，此函数返回空字符串
 * @deprecated 使用系统默认字体，不再需要生成字体声明
 */
export function generateFontFaces(_fontsPath: string): string {
  // 使用系统字体，无需生成 @font-face
  return "";
}

/**
 * 生成内嵌 base64 字体的 @font-face 声明
 * 已弃用：现在使用系统字体，此函数返回空字符串
 * @deprecated 使用系统默认字体，不再需要生成字体声明
 */
export function generateEmbeddedFontFaces(_lxgwBase64: string, _jetBrainsBase64: string): string {
  // 使用系统字体，无需生成 @font-face
  return "";
}

/**
 * 字体文件名常量（保留空对象以保持兼容性）
 * @deprecated 使用系统默认字体，不再需要字体文件
 */
export const FONT_FILES = {} as const;
