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
