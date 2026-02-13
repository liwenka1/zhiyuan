import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { markdownToHTML } from "@/lib/markdown-processor";
import type { ExportLayoutConfig } from "@shared";

interface RenderNoteExportPreviewHtmlOptions {
  title: string;
  markdown: string;
  themeId: string;
  layout?: Partial<ExportLayoutConfig>;
  notePath?: string; // 笔记文件路径，用于解析相对资源路径
}

/**
 * 渲染当前笔记的导出预览 HTML（无导出副作用，仅生成字符串）。
 */
export async function renderNoteExportPreviewHtml(options: RenderNoteExportPreviewHtmlOptions): Promise<string> {
  const bodyHtml = await markdownToHTML(options.markdown, options.notePath);
  return generateHTMLDocument(options.title, bodyHtml, {
    themeId: options.themeId,
    format: "html",
    layout: options.layout
  });
}
