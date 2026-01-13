/**
 * Markdown 转 HTML 工具函数
 * 用于导出功能，生成带样式的完整 HTML 文档
 * 样式与预览组件保持一致，基于 Tailwind Typography prose 类
 */

import { getThemeColors, generateProseStyles, generateFontFaces, generateEmbeddedFontFaces } from "./export-styles";

// 直接导入库里的 CSS 文件（与预览模式使用相同的样式）
import highlightLight from "highlight.js/styles/github.css?raw";
import highlightDark from "highlight.js/styles/github-dark.css?raw";
import katexStyles from "katex/dist/katex.min.css?raw";

export interface HTMLDocumentOptions {
  /** 是否为深色主题 */
  isDark: boolean;
  /** 字体配置 */
  fonts?:
    | { type: "path"; path: string } // HTML 资源包：使用相对路径
    | { type: "embedded"; lxgwBase64: string; jetBrainsBase64: string }; // PDF/图片：内嵌 base64
}

/**
 * 生成完整的 HTML 文档
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 * @param options 配置选项
 */
export function generateHTMLDocument(
  title: string,
  htmlContent: string,
  options: HTMLDocumentOptions | boolean
): string {
  // 兼容旧的 isDark 参数
  const opts: HTMLDocumentOptions = typeof options === "boolean" ? { isDark: options } : options;

  const colors = getThemeColors(opts.isDark ? "dark" : "light");
  const proseStyles = generateProseStyles(colors);
  const highlightStyles = opts.isDark ? highlightDark : highlightLight;

  // 生成字体样式
  let fontStyles = "";
  if (opts.fonts) {
    if (opts.fonts.type === "path") {
      fontStyles = generateFontFaces(opts.fonts.path);
    } else if (opts.fonts.type === "embedded") {
      fontStyles = generateEmbeddedFontFaces(opts.fonts.lxgwBase64, opts.fonts.jetBrainsBase64);
    }
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="zhiyuan">
  <title>${title}</title>
  <style>
${fontStyles}
${proseStyles}
${highlightStyles}
${katexStyles}
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
