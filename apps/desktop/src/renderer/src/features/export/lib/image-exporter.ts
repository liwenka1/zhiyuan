import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
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

  // 3. 获取字体 base64
  const fonts = await exportIpc.getFontsBase64();

  // 4. 将 Markdown 转换为 HTML
  const htmlBody = await markdownToHTML(note.content);

  // 5. 生成完整的 HTML 文档（内嵌字体）
  const fullHTML = generateHTMLDocument(note.title, htmlBody, {
    themeId,
    format: "image",
    layout,
    fonts: { type: "embedded", ...fonts }
  });

  // 6. 导出为图片（传入 notePath 以支持本地图片）
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

  // 3. 获取字体 base64
  const fonts = await exportIpc.getFontsBase64();

  // 4. 分割 Markdown
  const sections = splitMarkdownByHr(note.content);

  if (sections.length === 0) {
    throw new Error("没有内容可导出");
  }

  // 5. 为每个分片生成 HTML（内嵌字体）
  const htmlContents = await Promise.all(
    sections.map(async (section) => {
      const htmlBody = await markdownToHTML(section);
      return generateHTMLDocument(note.title, htmlBody, {
        themeId,
        format: "image",
        layout,
        fonts: { type: "embedded", ...fonts }
      });
    })
  );

  // 6. 导出为多张图片
  await exportIpc.exportAsImagePages(htmlContents, folderPath, note.title, note.filePath);
}
