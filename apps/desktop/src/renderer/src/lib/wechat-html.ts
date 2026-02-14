/**
 * 微信公众号 HTML 生成工具
 * 用于生成适配微信公众号编辑器的 HTML 内容
 * 样式基于统一的导出样式系统
 */

import { buildWechatStyleBundle } from "@/features/export/lib/styles";
import type { ExportLayoutConfig } from "@shared";

/**
 * 生成适配微信公众号的 HTML 文档
 * 所有样式将被内联到 HTML 标签中
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 * @param themeId 导出主题预设 ID，深色主题会自动 fallback 到 default 以保证可读性
 */
export function generateWechatHTMLDocument(
  title: string,
  htmlContent: string,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): string {
  const { styles } = buildWechatStyleBundle(themeId, layout);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
${styles}
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * 将 Markdown 内容转换为微信公众号格式的 HTML
 * 在渲染进程中直接处理，不需要通过 IPC
 */
export { markdownToHTML as markdownToWechatHTML } from "./markdown-processor";
