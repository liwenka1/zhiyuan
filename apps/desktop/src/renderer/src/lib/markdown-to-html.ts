/**
 * Markdown 转 HTML 工具函数
 * 用于导出功能，生成带样式的完整 HTML 文档
 * 样式与预览组件保持一致，基于 Tailwind Typography prose 类
 */

import { getThemeColors, generateProseStyles } from "./export-styles";

/**
 * 生成完整的 HTML 文档
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 * @param isDark 是否为深色主题
 */
export function generateHTMLDocument(title: string, htmlContent: string, isDark: boolean): string {
  const colors = getThemeColors(isDark ? "dark" : "light");
  const styles = generateProseStyles(colors);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="xx-note">
  <title>${title}</title>
  <style>
${styles}
  </style>
</head>
<body>
  <div class="prose">
${htmlContent}
  </div>
</body>
</html>`;
}

/**
 * 将 Markdown 内容转换为 HTML
 * 在渲染进程中直接处理，不需要通过 IPC
 */
export { markdownToHTML } from "./markdown-processor";
