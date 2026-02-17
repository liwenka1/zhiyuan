/**
 * Markdown 转 HTML 工具函数
 * 用于导出功能，生成带样式的完整 HTML 文档
 * 样式与预览组件保持一致，基于 Tailwind Typography prose 类
 */

import { buildProseStyleBundle } from "@/features/export/lib/styles";
import { type ExportTargetFormat } from "@/features/export/lib/layout-capabilities";
import type { ExportLayoutConfig } from "@shared";

import katexStyles from "katex/dist/katex.min.css?raw";

export interface HTMLDocumentOptions {
  /** 导出主题预设 ID（由调用方从 store 获取并传入） */
  themeId: string;
  /** 当前导出目标格式（用于能力规则过滤） */
  format?: Extract<ExportTargetFormat, "html" | "pdf" | "image">;
  /** 导出布局配置（仅应用于该格式支持的字段） */
  layout?: Partial<ExportLayoutConfig>;
  /** 字体配置（已弃用：现在使用系统默认字体） */
  fonts?: never;
}

/**
 * 生成完整的 HTML 文档
 * @param title 笔记标题
 * @param htmlContent HTML 内容
 * @param options 配置选项
 */
export function generateHTMLDocument(title: string, htmlContent: string, options: HTMLDocumentOptions): string {
  const format = options.format ?? "html";
  const { proseStyles } = buildProseStyleBundle(options.themeId, format, options.layout);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="zhiyuan">
  <title>${title}</title>
  <style>
${proseStyles}
${katexStyles}
  </style>
</head>
<body>
  <div class="export-layout-shell">
    <div class="export-layout-content">
      <div class="prose">
${htmlContent}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 将 Markdown 内容转换为 HTML
 * 在渲染进程中直接处理，不需要通过 IPC
 */
export { markdownToHTML } from "./markdown-processor";
