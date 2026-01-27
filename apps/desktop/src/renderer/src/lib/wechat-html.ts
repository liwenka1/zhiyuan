/**
 * 微信公众号 HTML 生成工具
 * 用于生成适配微信公众号编辑器的 HTML 内容
 * 样式基于统一的导出样式系统
 */

import { getThemeColors, generateWechatStyles } from "@/features/export/lib/styles";

/**
 * 生成适配微信公众号的 HTML 文档
 * 所有样式将被内联到 HTML 标签中
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 */
export function generateWechatHTMLDocument(title: string, htmlContent: string): string {
  const colors = getThemeColors("wechat");
  const styles = generateWechatStyles(colors);

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
