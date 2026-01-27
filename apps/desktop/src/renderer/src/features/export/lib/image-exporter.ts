import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
import i18n from "@/lib/i18n";

/**
 * 导出笔记为图片（单张长图）
 */
export async function exportNoteAsImage(note: Note, isDark: boolean): Promise<void> {
  try {
    // 1. 获取下载目录
    const downloadsPath = await window.api.export.getDownloadsPath();

    // 2. 显示保存对话框
    const defaultFileName = `${note.title}.png`;
    const filePath = await window.api.export.showSaveDialog({
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
    const fonts = await window.api.export.getFontsBase64();

    // 4. 将 Markdown 转换为 HTML
    const htmlBody = await markdownToHTML(note.content);

    // 5. 生成完整的 HTML 文档（内嵌字体）
    const fullHTML = generateHTMLDocument(note.title, htmlBody, {
      isDark,
      fonts: { type: "embedded", ...fonts }
    });

    // 6. 导出为图片（传入 notePath 以支持本地图片）
    await window.api.export.exportAsImage(fullHTML, filePath, note.filePath);

    console.log("导出图片成功:", filePath);
  } catch (error) {
    console.error("导出图片失败:", error);
    throw error;
  }
}

/**
 * 导出笔记为图片（分页）
 */
export async function exportNoteAsImagePages(note: Note, isDark: boolean): Promise<void> {
  try {
    // 1. 获取下载目录
    const downloadsPath = await window.api.export.getDownloadsPath();

    // 2. 显示保存对话框 - 选择文件夹
    const defaultFolderName = `${note.title}-${i18n.t("note:pagesSuffix")}`;
    const folderPath = await window.api.export.showSaveDialog({
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
    const fonts = await window.api.export.getFontsBase64();

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
          isDark,
          fonts: { type: "embedded", ...fonts }
        });
      })
    );

    // 6. 导出为多张图片
    const result = await window.api.export.exportAsImagePages(htmlContents, folderPath, note.title, note.filePath);

    console.log(`导出成功: ${result.filesCount} 张图片`);
  } catch (error) {
    console.error("导出图片分页失败:", error);
    throw error;
  }
}
