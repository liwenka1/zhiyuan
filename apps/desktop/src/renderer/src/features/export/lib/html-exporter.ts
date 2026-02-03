import { Note } from "@/types";
import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import i18n from "@/lib/i18n";

/**
 * 导出笔记为 HTML
 */
export async function exportNoteAsHTML(note: Note, isDark: boolean): Promise<void> {
  try {
    // 1. 获取下载目录
    const downloadsResult = await window.api.export.getDownloadsPath();
    if (!downloadsResult.ok) {
      throw new Error(downloadsResult.error.message);
    }

    // 2. 显示保存对话框 - 选择文件夹
    const defaultFolderName = `${note.title}`;
    const dialogResult = await window.api.export.showSaveDialog({
      title: i18n.t("note:dialog.exportHTML.title"),
      defaultPath: `${downloadsResult.value}/${defaultFolderName}`,
      filters: [
        { name: i18n.t("note:fileTypes.folder"), extensions: [] },
        { name: i18n.t("note:fileTypes.allFiles"), extensions: ["*"] }
      ]
    });

    if (!dialogResult.ok) {
      throw new Error(dialogResult.error.message);
    }

    // 用户取消了保存
    if (!dialogResult.value) {
      throw new Error("USER_CANCELLED");
    }

    const folderPath = dialogResult.value;

    // 3. 将 Markdown 转换为 HTML
    const htmlBody = await markdownToHTML(note.content);

    // 4. 生成完整的 HTML 文档（带字体路径）
    const fullHTML = generateHTMLDocument(note.title, htmlBody, {
      isDark,
      fonts: { type: "path", path: "./assets" }
    });

    // 5. 导出为资源包（包含所有图片和字体等资源）
    const exportResult = await window.api.export.exportHTMLPackage(fullHTML, folderPath, note.filePath, "assets");
    if (!exportResult.ok) {
      throw new Error(exportResult.error.message);
    }

    console.log("导出成功:", exportResult.value);
    console.log(`已导出 ${exportResult.value.filesCount} 个文件`);
  } catch (error) {
    console.error("导出 HTML 失败:", error);
    throw error;
  }
}
