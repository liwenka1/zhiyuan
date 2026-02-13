import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { markdownToHTML } from "@/lib/markdown-processor";
import { getExportThemeColors } from "./styles";
import { isDarkColor } from "@/lib/color-utils";
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
  // 根据主题判断是否为深色模式（用于 Mermaid 图表配色）
  const themeColors = getExportThemeColors(options.themeId);
  const isDarkTheme = isDarkColor(themeColors.background) === true;

  const bodyHtml = await markdownToHTML(options.markdown, {
    notePath: options.notePath,
    isDarkTheme
  });

  return generateHTMLDocument(options.title, bodyHtml, {
    themeId: options.themeId,
    format: "html",
    layout: options.layout
  });
}
