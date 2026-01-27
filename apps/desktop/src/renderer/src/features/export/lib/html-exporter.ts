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
    const downloadsPath = await window.api.export.getDownloadsPath();

    // 2. 显示保存对话框 - 选择文件夹
    const defaultFolderName = `${note.title}`;
    const folderPath = await window.api.export.showSaveDialog({
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
      isDark,
      fonts: { type: "path", path: "./assets" }
    });

    // 5. 导出为资源包（包含所有图片和字体等资源）
    const result = await window.api.export.exportHTMLPackage(fullHTML, folderPath, note.filePath, "assets");

    console.log("导出成功:", result);
    console.log(`已导出 ${result.filesCount} 个文件`);
  } catch (error) {
    console.error("导出 HTML 失败:", error);
    throw error;
  }
}
