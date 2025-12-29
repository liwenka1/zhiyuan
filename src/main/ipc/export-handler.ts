import { ipcMain, dialog, app, BrowserWindow, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";

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
 * 获取图片的 MIME 类型
 */
function getImageMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon"
  };
  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}

/**
 * 将 HTML 中的本地图片转换为 Base64 内嵌
 * 用于 PDF 导出时确保图片能正常显示
 */
async function embedLocalImages(htmlContent: string, notePath?: string): Promise<string> {
  if (!notePath) return htmlContent;

  const noteDir = path.dirname(notePath);
  let result = htmlContent;

  // 匹配所有 img 标签的 src 属性
  const imgRegex = /<img[^>]+src=(["'])([^"']+)\1[^>]*>/gi;
  const matches = [...htmlContent.matchAll(imgRegex)];

  for (const match of matches) {
    const fullMatch = match[0];
    const quote = match[1];
    const src = match[2];

    // 只处理相对路径
    if (!isRelativePath(src)) continue;

    try {
      const imagePath = path.join(noteDir, src.replace(/^\.\//, ""));

      // 检查文件是否存在
      try {
        await fs.access(imagePath);
      } catch {
        console.warn(`图片文件不存在: ${imagePath}`);
        continue;
      }

      const imageBuffer = await fs.readFile(imagePath);
      const ext = path.extname(imagePath);
      const mimeType = getImageMimeType(ext);
      const base64 = imageBuffer.toString("base64");
      const dataUri = `data:${mimeType};base64,${base64}`;

      // 替换 src 属性
      const newImgTag = fullMatch.replace(`src=${quote}${src}${quote}`, `src=${quote}${dataUri}${quote}`);
      result = result.replace(fullMatch, newImgTag);
    } catch (error) {
      console.warn(`无法嵌入图片: ${src}`, error);
    }
  }

  return result;
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
  ipcMain.handle("export:export-as-pdf", async (_, htmlContent: string, filePath: string, notePath?: string) => {
    let pdfWindow: BrowserWindow | null = null;
    let tempHtmlPath: string | null = null;

    try {
      // 将本地图片转换为 Base64 内嵌，确保 PDF 中图片能正常显示
      const processedHtml = await embedLocalImages(htmlContent, notePath);

      // 将 HTML 保存为临时文件，避免 data URL 长度限制
      tempHtmlPath = path.join(tmpdir(), `pdf-export-${Date.now()}.html`);
      await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

      pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // 使用 file:// 协议加载临时文件
      await pdfWindow.loadFile(tempHtmlPath);

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
      // 清理临时文件
      if (tempHtmlPath) {
        try {
          await fs.unlink(tempHtmlPath);
        } catch {
          // 忽略删除失败
        }
      }
    }
  });

  // 导出为图片（单张长图）
  ipcMain.handle(
    "export:export-as-image",
    async (_, htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) => {
      let imageWindow: BrowserWindow | null = null;
      let tempHtmlPath: string | null = null;
      const width = options?.width || 800;

      try {
        // 将本地图片转换为 Base64 内嵌
        const processedHtml = await embedLocalImages(htmlContent, notePath);

        // 将 HTML 保存为临时文件
        tempHtmlPath = path.join(tmpdir(), `image-export-${Date.now()}.html`);
        await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

        // 创建隐藏窗口，初始高度设为较小值
        imageWindow = new BrowserWindow({
          width,
          height: 600,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        });

        await imageWindow.loadFile(tempHtmlPath);

        // 等待页面渲染完成
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 获取页面实际内容高度
        const contentHeight = await imageWindow.webContents.executeJavaScript(
          "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
        );

        // 调整窗口大小为内容实际尺寸
        imageWindow.setContentSize(width, contentHeight);

        // 等待窗口调整完成
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 截取整个页面
        const image = await imageWindow.webContents.capturePage();

        // 根据文件扩展名决定格式
        const ext = path.extname(filePath).toLowerCase();
        let imageData: Buffer;

        if (ext === ".jpg" || ext === ".jpeg") {
          imageData = image.toJPEG(90);
        } else {
          imageData = image.toPNG();
        }

        await fs.writeFile(filePath, imageData);
      } finally {
        if (imageWindow && !imageWindow.isDestroyed()) {
          imageWindow.close();
        }
        if (tempHtmlPath) {
          try {
            await fs.unlink(tempHtmlPath);
          } catch {
            // 忽略删除失败
          }
        }
      }
    }
  );

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
