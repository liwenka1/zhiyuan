import { ipcMain, dialog, app, BrowserWindow, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * 判断是否为相对路径
 */
function isRelativePath(src: string): boolean {
  if (!src) return false;
  // 排除协议路径和 data URI
  if (/^(https?:|data:|file:|blob:|#|mailto:|local-resource:)/.test(src)) return false;
  return true;
}

/**
 * 注册导出相关的 IPC handlers
 */
export function registerExportHandlers(): void {
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
      const result = await dialog.showSaveDialog({
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });

      return result.canceled ? null : result.filePath;
    }
  );

  // 保存 HTML 文件
  ipcMain.handle("export:save-html-file", async (_, filePath: string, htmlContent: string) => {
    await fs.writeFile(filePath, htmlContent, "utf-8");
  });

  // 获取用户下载目录
  ipcMain.handle("export:get-downloads-path", () => {
    return app.getPath("downloads");
  });

  // 导出为 PDF
  ipcMain.handle("export:export-as-pdf", async (_, htmlContent: string, filePath: string) => {
    let pdfWindow: BrowserWindow | null = null;

    try {
      pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // 等待页面渲染完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pdfData = await pdfWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });

      await fs.writeFile(filePath, pdfData);
    } finally {
      if (pdfWindow && !pdfWindow.isDestroyed()) {
        pdfWindow.close();
      }
    }
  });

  // 复制 HTML 到剪贴板（用于微信公众号）
  ipcMain.handle("export:copy-html-to-clipboard", (_, htmlContent: string) => {
    clipboard.writeHTML(htmlContent);
  });

  // 导出 HTML 资源包（包含所有图片等资源）
  ipcMain.handle(
    "export:export-html-package",
    async (_, htmlContent: string, outputPath: string, notePath: string | undefined, assetsFolder = "assets") => {
      // 如果没有笔记路径，直接保存 HTML
      if (!notePath) {
        await fs.writeFile(outputPath, htmlContent, "utf-8");
        return { filesCount: 1 };
      }

      // 创建输出目录和资源目录
      await fs.mkdir(outputPath, { recursive: true });
      const assetsDir = path.join(outputPath, assetsFolder);
      await fs.mkdir(assetsDir, { recursive: true });

      // 收集并复制资源文件
      const { processedHtml, copiedFiles } = await collectAndCopyAssets(htmlContent, notePath, assetsDir, assetsFolder);

      // 保存处理后的 HTML
      await fs.writeFile(path.join(outputPath, "index.html"), processedHtml, "utf-8");

      return {
        filesCount: copiedFiles.length + 1,
        copiedFiles
      };
    }
  );
}

/**
 * 收集并复制 HTML 中的资源文件（图片、视频等）
 */
async function collectAndCopyAssets(
  html: string,
  notePath: string,
  assetsDir: string,
  assetsFolderName: string
): Promise<{ processedHtml: string; copiedFiles: string[] }> {
  const noteDir = path.dirname(notePath);
  const copiedFiles: string[] = [];
  const fileMap = new Map<string, string>();
  const copiedFileNames = new Set<string>();

  // 匹配 HTML 中的资源标签
  const resourceRegex = /<(img|video|audio|source)[^>]+(src|href)=(["'])([^"']+)\3[^>]*>/gi;
  const matches = html.matchAll(resourceRegex);

  // 并行处理所有资源文件
  const promises = Array.from(matches).map(async (match) => {
    const src = match[4];

    // 只处理相对路径和 file:// 协议的本地资源
    if (!isRelativePath(src) && !src.startsWith("file://")) {
      return;
    }

    try {
      // 解析源文件路径
      let sourcePath: string;
      if (src.startsWith("file://")) {
        sourcePath = decodeURIComponent(src.replace(/^file:\/\//, ""));
      } else {
        sourcePath = path.join(noteDir, src.replace(/^\.\//, ""));
      }

      // 检查文件是否存在
      try {
        await fs.access(sourcePath);
      } catch {
        console.warn(`资源文件不存在: ${sourcePath}`);
        return;
      }

      // 生成目标文件名，处理重名
      const ext = path.extname(sourcePath);
      const basename = path.basename(sourcePath, ext);
      let fileName = `${basename}${ext}`;
      let counter = 1;

      while (copiedFileNames.has(fileName)) {
        fileName = `${basename}-${counter}${ext}`;
        counter++;
      }

      copiedFileNames.add(fileName);

      // 复制文件
      const destPath = path.join(assetsDir, fileName);
      await fs.copyFile(sourcePath, destPath);
      copiedFiles.push(destPath);

      // 记录路径映射
      const relativePath = `./${assetsFolderName}/${fileName}`;
      fileMap.set(src, relativePath);
    } catch (error) {
      console.error(`复制资源失败: ${src}`, error);
    }
  });

  await Promise.all(promises);

  // 替换 HTML 中的资源路径
  let processedHtml = html;
  fileMap.forEach((newPath, oldPath) => {
    const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    processedHtml = processedHtml.replace(new RegExp(escapedOldPath, "g"), newPath);
  });

  return { processedHtml, copiedFiles };
}
