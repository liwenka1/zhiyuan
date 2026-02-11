import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import i18n from "@/lib/i18n";
import { exportIpc } from "@/ipc";
import type { ExportLayoutConfig } from "@shared";

/**
 * 导出笔记为 HTML
 * @param note 要导出的笔记
 * @param themeId 导出主题预设 ID，决定导出颜色方案
 */
export async function exportNoteAsHTML(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<void> {
  // 1. 获取下载目录
  const downloadsPath = await exportIpc.getDownloadsPath();

  // 2. 显示保存对话框 - 选择文件夹
  const defaultFolderName = `${note.title}`;
  const folderPath = await exportIpc.showSaveDialog({
    title: i18n.t("note:dialog.exportHTML.title"),
    defaultPath: `${downloadsPath}/${defaultFolderName}`,
    filters: [
      { name: i18n.t("note:fileTypes.folder"), extensions: [] },
      { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
    ]
  });

  // 用户取消了保存
  if (!folderPath) {
    throw new Error("USER_CANCELLED");
  }

  // 3. 将 Markdown 转换为 HTML
  const htmlBody = await markdownToHTML(note.content);

  // 4. 生成完整的 HTML 文档（带字体路径）
  const fullHTML = generateHTMLDocument(note.title, htmlBody, {
    themeId,
    format: "html",
    layout,
    fonts: { type: "path", path: "./assets" }
  });

  // 5. 导出为资源包（包含所有图片和字体等资源）
  await exportIpc.exportHTMLPackage(fullHTML, folderPath, note.filePath, "assets");
}
