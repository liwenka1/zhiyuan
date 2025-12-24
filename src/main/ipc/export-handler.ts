import { ipcMain, dialog, app, BrowserWindow } from "electron";
import * as fs from "fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

/**
 * 注册导出相关的 IPC handlers
 */
export function registerExportHandlers(): void {
  // Markdown 转 HTML
  ipcMain.handle("export:markdown-to-html", async (_, markdown: string) => {
    try {
      // 使用 unified 处理 Markdown
      const file = await unified()
        .use(remarkParse) // 解析 Markdown
        .use(remarkGfm) // 支持 GitHub Flavored Markdown
        .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
        .use(rehypeRaw) // 支持原始 HTML
        .use(rehypeSlug) // 为标题添加 id
        .use(rehypeStringify) // 转换为 HTML 字符串
        .process(markdown);

      return String(file);
    } catch (error) {
      console.error("Markdown 转 HTML 失败:", error);
      throw error;
    }
  });

  // 显示保存对话框
  ipcMain.handle(
    "export:show-save-dialog",
    async (
      _,
      options: {
        title: string;
        defaultPath: string;
        filters: Array<{ name: string; extensions: string[] }>;
      }
    ) => {
      try {
        const result = await dialog.showSaveDialog({
          title: options.title,
          defaultPath: options.defaultPath,
          filters: options.filters,
          properties: ["createDirectory", "showOverwriteConfirmation"]
        });

        if (result.canceled || !result.filePath) {
          return null;
        }

        return result.filePath;
      } catch (error) {
        console.error("显示保存对话框失败:", error);
        throw error;
      }
    }
  );

  // 保存 HTML 文件
  ipcMain.handle("export:save-html-file", async (_, filePath: string, htmlContent: string) => {
    try {
      await fs.writeFile(filePath, htmlContent, "utf-8");
      return { success: true };
    } catch (error) {
      console.error("保存 HTML 文件失败:", error);
      throw error;
    }
  });

  // 获取用户下载目录
  ipcMain.handle("export:get-downloads-path", async () => {
    try {
      return app.getPath("downloads");
    } catch (error) {
      console.error("获取下载目录失败:", error);
      throw error;
    }
  });

  // 导出为 PDF
  ipcMain.handle("export:export-as-pdf", async (_, htmlContent: string, filePath: string) => {
    let pdfWindow: BrowserWindow | null = null;

    try {
      // 创建隐藏的 BrowserWindow 用于生成 PDF
      pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false, // 不显示窗口
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // 加载 HTML 内容
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // 等待页面加载完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 生成 PDF
      const pdfData = await pdfWindow.webContents.printToPDF({
        printBackground: true, // 打印背景色
        pageSize: "A4",
        margins: {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5
        }
      });

      // 保存 PDF 文件
      await fs.writeFile(filePath, pdfData);

      return { success: true };
    } catch (error) {
      console.error("导出 PDF 失败:", error);
      throw error;
    } finally {
      // 关闭隐藏窗口
      if (pdfWindow && !pdfWindow.isDestroyed()) {
        pdfWindow.close();
      }
    }
  });
}
