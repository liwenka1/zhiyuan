import { buildExportDocumentFromMarkdown } from "./export-pipeline";
import { buildProseStyleBundle } from "./styles";
import { isDarkColor } from "@/lib/color-utils";
import { exportIpc } from "@/ipc/export";
import i18n from "@/lib/i18n";
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
export async function renderNoteExportPreviewHtml(
  options: RenderNoteExportPreviewHtmlOptions,
  signal?: AbortSignal
): Promise<string> {
  // 根据主题判断是否为深色模式（用于 Mermaid 图表配色）
  const { colors } = buildProseStyleBundle(options.themeId, "html", options.layout);
  const isDarkTheme = isDarkColor(colors.background) === true;

  const html = await buildExportDocumentFromMarkdown({
    title: options.title,
    markdown: options.markdown,
    themeId: options.themeId,
    format: "html",
    layout: options.layout,
    notePath: options.notePath,
    isDarkTheme
  });
  signal?.throwIfAborted();
  return exportIpc.prepareHtmlPreview(html, options.notePath, i18n.t("note:export.assetOmitted"));
}
