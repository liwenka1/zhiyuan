import { Note } from "@/types";
import { buildExportDocument, buildExportDocumentsBySections } from "./export-pipeline";
import i18n from "@/lib/i18n";
import { exportIpc } from "@/ipc";
import type { ExportLayoutConfig } from "@shared";

/**
 * 导出笔记为图片（单张长图）
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function exportNoteAsImage(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 获取下载目录
  const downloadsPath = await exportIpc.getDownloadsPath();

  // 2. 显示保存对话框
  const defaultFileName = `${note.title}.png`;
  const filePath = await exportIpc.showSaveDialog({
    title: i18n.t("note:dialog.exportImage.title"),
    defaultPath: `${downloadsPath}/${defaultFileName}`,
    filters: [
      { name: i18n.t("note:fileTypes.pngImage"), extensions: ["png"] },
      { name: i18n.t("note:fileTypes.jpegImage"), extensions: ["jpg", "jpeg"] },
      { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
    ]
  });

  // 用户取消了保存
  if (!filePath) {
    throw new Error("USER_CANCELLED");
  }

  // 3. 将 Markdown 转换为 HTML
  const fullHTML = await buildExportDocument(note, "image", themeId, layout);

  // 5. 导出为图片（传入 notePath 以支持本地图片）
  await exportIpc.exportAsImage(fullHTML, filePath, note.filePath);
}

/**
 * 导出笔记为图片（分页）
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function exportNoteAsImagePages(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 获取下载目录
  const downloadsPath = await exportIpc.getDownloadsPath();

  // 2. 显示保存对话框 - 选择文件夹
  const defaultFolderName = `${note.title}-${i18n.t("note:pagesSuffix")}`;
  const folderPath = await exportIpc.showSaveDialog({
    title: i18n.t("note:dialog.exportImagePages.title"),
    defaultPath: `${downloadsPath}/${defaultFolderName}`,
    filters: [
      { name: i18n.t("note:fileTypes.folder"), extensions: [] },
      { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
    ]
  });

  if (!folderPath) {
    throw new Error("USER_CANCELLED");
  }

  const htmlContents = await buildExportDocumentsBySections(note, "image", themeId, layout);

  // 5. 导出为多张图片
  await exportIpc.exportAsImagePages(htmlContents, folderPath, note.title, note.filePath);
}
