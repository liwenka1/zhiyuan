import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
import i18n from "@/lib/i18n";
import { exportIpc } from "@/ipc";
import type { ExportLayoutConfig } from "@shared";

/**
 * 导出笔记为 PDF（单页）
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function exportNoteAsPDF(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 获取下载目录
  const downloadsPath = await exportIpc.getDownloadsPath();

  // 2. 显示保存对话框
  const defaultFileName = `${note.title}.pdf`;
  const filePath = await exportIpc.showSaveDialog({
    title: i18n.t("note:dialog.exportPDF.title"),
    defaultPath: `${downloadsPath}/${defaultFileName}`,
    filters: [
      { name: i18n.t("note:fileTypes.pdfFile"), extensions: ["pdf"] },
      { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
    ]
  });

  // 用户取消了保存
  if (!filePath) {
    throw new Error("USER_CANCELLED");
  }

  // 3. 将 Markdown 转换为 HTML
  const htmlBody = await markdownToHTML(note.content);

  // 4. 生成完整的 HTML 文档
  const fullHTML = generateHTMLDocument(note.title, htmlBody, {
    themeId,
    format: "pdf",
    layout
  });

  // 5. 导出为 PDF（传入 notePath 以支持本地图片）
  await exportIpc.exportAsPDF(fullHTML, filePath, note.filePath);
}

/**
 * 导出笔记为 PDF（分页）
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function exportNoteAsPDFPages(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 获取下载目录
  const downloadsPath = await exportIpc.getDownloadsPath();

  // 2. 显示保存对话框
  const defaultFileName = `${note.title}.pdf`;
  const filePath = await exportIpc.showSaveDialog({
    title: i18n.t("note:dialog.exportPDFPages.title"),
    defaultPath: `${downloadsPath}/${defaultFileName}`,
    filters: [
      { name: i18n.t("note:fileTypes.pdfFile"), extensions: ["pdf"] },
      { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
    ]
  });

  if (!filePath) {
    throw new Error("USER_CANCELLED");
  }

  // 3. 分割 Markdown
  const sections = splitMarkdownByHr(note.content);

  if (sections.length === 0) {
    throw new Error("没有内容可导出");
  }

  // 4. 为每个分片生成 HTML
  const htmlContents = await Promise.all(
    sections.map(async (section) => {
      const htmlBody = await markdownToHTML(section);
      return generateHTMLDocument(note.title, htmlBody, {
        themeId,
        format: "pdf",
        layout
      });
    })
  );

  // 5. 导出为单个 PDF（多页）
  await exportIpc.exportAsPDFPages(htmlContents, filePath, note.filePath);
}
