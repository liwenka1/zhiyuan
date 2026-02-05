import { ipcMain, dialog, app, BrowserWindow, clipboard, NativeImage } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { PDFDocument } from "pdf-lib";
import { wrapIpcHandler, ipcOk, ipcErr } from "./ipc-result";
import type { IpcResultDTO } from "@shared";

/**
 * 字体文件名常量（与 export-styles.ts 保持一致）
 */
const FONT_FILES = {
  lxgwWenKai: "LXGWWenKaiMono-Medium.ttf",
  jetBrainsMono: "JetBrainsMono-Regular.ttf"
} as const;

/**
 * 获取字体文件目录路径
 * 开发环境和生产环境路径不同
 */
function getFontsDir(): string {
  if (app.isPackaged) {
    // 生产环境：字体在 resources/app.asar/out/renderer/fonts
    return path.join(process.resourcesPath, "app.asar", "out", "renderer", "fonts");
  } else {
    // 开发环境：electron-vite 使用 dev server，不会输出到 out/renderer
    // 需要直接从源代码目录读取字体文件
    // __dirname 在开发环境是 out/main，需要回到 apps/desktop 然后进入 src/renderer/public/fonts
    return path.join(__dirname, "..", "..", "src", "renderer", "public", "fonts");
  }
}

/**
 * 读取字体文件并转换为 base64
 */
async function loadFontAsBase64(fontFileName: string): Promise<string> {
  const fontsDir = getFontsDir();
  const fontPath = path.join(fontsDir, fontFileName);
  const fontBuffer = await fs.readFile(fontPath);
  return fontBuffer.toString("base64");
}

/**
 * 加载所有字体为 base64（用于 PDF/图片导出）
 */
export async function loadAllFontsAsBase64(): Promise<{ lxgwBase64: string; jetBrainsBase64: string }> {
  const [lxgwBase64, jetBrainsBase64] = await Promise.all([
    loadFontAsBase64(FONT_FILES.lxgwWenKai),
    loadFontAsBase64(FONT_FILES.jetBrainsMono)
  ]);
  return { lxgwBase64, jetBrainsBase64 };
}

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
 * 支持相对路径和 local-resource:// 协议
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

    // 处理 local-resource:// 协议（normalizeMarkdownPaths 转换后的路径）
    let imagePath: string;
    if (src.startsWith("local-resource://")) {
      // 从 local-resource:// URL 中提取本地路径
      // local-resource://localhost/Users/... -> /Users/...
      // local-resource:///Users/... -> /Users/...
      const urlPath = src.replace(/^local-resource:\/\//, "");
      // 移除可能的 localhost 前缀
      imagePath = decodeURIComponent(urlPath.replace(/^localhost/, ""));
    } else if (isRelativePath(src)) {
      // 处理相对路径
      imagePath = path.resolve(noteDir, src.replace(/^\.\//, ""));
    } else {
      // 跳过其他协议（http、https、data 等）
      continue;
    }

    // 检查文件是否存在
    try {
      await fs.access(imagePath);
    } catch {
      continue;
    }

    // 读取并嵌入图片
    const imageBuffer = await fs.readFile(imagePath).catch(() => null);
    if (!imageBuffer) continue;

    const ext = path.extname(imagePath);
    const mimeType = getImageMimeType(ext);
    const base64 = imageBuffer.toString("base64");
    const dataUri = `data:${mimeType};base64,${base64}`;

    // 替换 src 属性
    const newImgTag = fullMatch.replace(`src=${quote}${src}${quote}`, `src=${quote}${dataUri}${quote}`);
    result = result.replace(fullMatch, newImgTag);
  }

  return result;
}

/**
 * 等待页面资源加载完成
 * 使用 JavaScript 检查所有图片和媒体是否加载完成
 */
async function waitForPageLoad(webContents: Electron.WebContents, timeoutMs = 10000): Promise<void> {
  const startTime = Date.now();

  const checkLoadComplete = async (): Promise<boolean> => {
    try {
      // 检查页面加载状态和所有资源
      const isComplete = await webContents.executeJavaScript(`
        (function() {
          // 检查 document.readyState
          if (document.readyState !== 'complete') {
            return false;
          }

          // 检查所有图片是否加载完成
          const images = Array.from(document.images);
          const allImagesLoaded = images.every(img => img.complete && img.naturalHeight !== 0);
          if (!allImagesLoaded) {
            return false;
          }

          // 检查所有视频是否准备好
          const videos = Array.from(document.querySelectorAll('video'));
          const allVideosReady = videos.every(video => video.readyState >= 2); // HAVE_CURRENT_DATA
          if (!allVideosReady) {
            return false;
          }

          return true;
        })();
      `);

      return isComplete;
    } catch {
      return false;
    }
  };

  // 轮询检查，直到加载完成或超时
  while (Date.now() - startTime < timeoutMs) {
    if (await checkLoadComplete()) {
      // 加载完成后再等待一小段时间，确保渲染稳定
      await new Promise((resolve) => setTimeout(resolve, 100));
      return;
    }
    // 每 100ms 检查一次
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // 超时但不抛出错误，继续导出
}

/**
 * 带超时的 Promise 包装器
 * @param promise 原始 Promise
 * @param timeoutMs 超时时间（毫秒）
 * @param errorMessage 超时错误信息
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * 将 HTML 渲染为长图截图
 * PDF 和图片导出共用此逻辑
 */
async function captureHtmlAsImage(htmlContent: string, notePath?: string, width = 800): Promise<NativeImage> {
  let window: BrowserWindow | null = null;
  let tempHtmlPath: string | null = null;

  // 超时配置
  const DOM_READY_TIMEOUT = 30000; // 30 秒
  const EXECUTE_JS_TIMEOUT = 10000; // 10 秒
  const CAPTURE_TIMEOUT = 30000; // 30 秒

  try {
    // 将本地图片转换为 Base64 内嵌
    const processedHtml = await embedLocalImages(htmlContent, notePath);

    // 将 HTML 保存为临时文件
    tempHtmlPath = path.join(tmpdir(), `export-${Date.now()}.html`);
    await fs.writeFile(tempHtmlPath, processedHtml, "utf-8");

    window = new BrowserWindow({
      width,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 等待 DOM 结构准备好（带超时）
    const domReadyPromise = new Promise<void>((resolve) => {
      window!.webContents.once("dom-ready", () => resolve());
    });

    window.loadFile(tempHtmlPath);
    await withTimeout(domReadyPromise, DOM_READY_TIMEOUT, `DOM 加载超时 (${DOM_READY_TIMEOUT}ms)`);

    // 等待页面所有资源加载完成（图片、视频等）
    // waitForPageLoad 内部已有超时处理
    await waitForPageLoad(window.webContents);

    // 获取页面实际内容高度（带超时）
    const contentHeight = await withTimeout(
      window.webContents.executeJavaScript(
        "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
      ),
      EXECUTE_JS_TIMEOUT,
      `获取页面高度超时 (${EXECUTE_JS_TIMEOUT}ms)`
    );

    // 调整窗口大小为内容实际尺寸
    window.setContentSize(width, contentHeight);

    // 等待窗口尺寸调整完成（使用 resize 事件）
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1000); // 最多等待 1 秒
      window!.once("resize", () => {
        clearTimeout(timeout);
        // resize 后再等待一小段时间确保渲染完成
        setTimeout(resolve, 50);
      });
    });

    // 截取整个页面（带超时）
    return await withTimeout(window.webContents.capturePage(), CAPTURE_TIMEOUT, `页面截图超时 (${CAPTURE_TIMEOUT}ms)`);
  } finally {
    if (window && !window.isDestroyed()) {
      window.close();
    }
    if (tempHtmlPath) {
      await fs.unlink(tempHtmlPath).catch(() => {});
    }
  }
}

/**
 * 收集并复制 HTML 中的资源文件（图片、视频等）以及字体文件
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

  // 复制字体文件
  const fontsDir = getFontsDir();
  for (const fontFile of Object.values(FONT_FILES)) {
    const sourcePath = path.join(fontsDir, fontFile);
    const destPath = path.join(assetsDir, fontFile);
    const copied = await fs.copyFile(sourcePath, destPath).then(
      () => true,
      () => false
    );
    if (copied) {
      copiedFiles.push(destPath);
      copiedFileNames.add(fontFile);
    }
  }

  // 匹配 HTML 中的资源标签
  const resourceRegex = /<(img|video|audio|source)[^>]+(src|href)=(["'])([^"']+)\3[^>]*>/gi;
  const matches = html.matchAll(resourceRegex);

  // 并行处理所有资源文件
  const promises = Array.from(matches).map(async (match) => {
    const src = match[4];

    // 跳过网络资源（http、https、data 等）
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      return;
    }

    // 解析源文件路径
    let sourcePath: string;
    if (src.startsWith("local-resource://")) {
      // 处理 local-resource:// 协议（normalizeMarkdownPaths 转换后的路径）
      // local-resource://localhost/Users/... -> /Users/...
      // local-resource:///Users/... -> /Users/...
      const urlPath = src.replace(/^local-resource:\/\//, "");
      sourcePath = decodeURIComponent(urlPath.replace(/^localhost/, ""));
    } else if (src.startsWith("file://")) {
      // 处理 file:// 协议
      sourcePath = decodeURIComponent(src.replace(/^file:\/\//, ""));
    } else if (isRelativePath(src)) {
      // 处理相对路径
      sourcePath = path.resolve(noteDir, src.replace(/^\.\//, ""));
    } else {
      // 跳过其他协议
      return;
    }

    // 检查文件是否存在
    try {
      await fs.access(sourcePath);
    } catch {
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
    const copied = await fs.copyFile(sourcePath, destPath).then(
      () => true,
      () => false
    );
    if (copied) {
      copiedFiles.push(destPath);
      // 记录路径映射
      const relativePath = `./${assetsFolderName}/${fileName}`;
      fileMap.set(src, relativePath);
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

/**
 * 注册导出相关的 IPC handlers
 */
export function registerExportHandlers(): void {
  // 显示保存对话框
  ipcMain.handle(
    "export:show-save-dialog",
    wrapIpcHandler(
      async (options: {
        title: string;
        defaultPath: string;
        filters: Array<{ name: string; extensions: string[] }>;
      }) => {
        const result = await dialog.showSaveDialog({
          title: options.title,
          defaultPath: options.defaultPath,
          filters: options.filters,
          properties: ["createDirectory", "showOverwriteConfirmation"]
        });

        return result.canceled ? null : result.filePath;
      },
      "EXPORT_SHOW_SAVE_DIALOG_FAILED"
    )
  );

  // 保存 HTML 文件
  ipcMain.handle(
    "export:save-html-file",
    wrapIpcHandler(async (filePath: string, htmlContent: string) => {
      await fs.writeFile(filePath, htmlContent, "utf-8");
    }, "EXPORT_SAVE_HTML_FAILED")
  );

  // 获取用户下载目录
  ipcMain.handle("export:get-downloads-path", (): IpcResultDTO<string> => {
    try {
      return ipcOk(app.getPath("downloads"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_GET_DOWNLOADS_PATH_FAILED");
    }
  });

  // 获取字体 base64（用于 PDF/图片导出）
  ipcMain.handle(
    "export:get-fonts-base64",
    wrapIpcHandler(async () => {
      return await loadAllFontsAsBase64();
    }, "EXPORT_GET_FONTS_FAILED")
  );

  // 导出为 PDF（单页长图方式）
  ipcMain.handle(
    "export:export-as-pdf",
    wrapIpcHandler(async (htmlContent: string, filePath: string, notePath?: string) => {
      // 截取页面为长图
      const image = await captureHtmlAsImage(htmlContent, notePath);
      const pngData = image.toPNG();

      // 使用 pdf-lib 创建 PDF，将图片嵌入
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngData);

      // 创建与图片尺寸相同的页面
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);

      // 将图片绘制到页面
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height
      });

      // 保存 PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(filePath, pdfBytes);
    }, "EXPORT_PDF_FAILED")
  );

  // 导出为图片（单张长图）
  ipcMain.handle(
    "export:export-as-image",
    wrapIpcHandler(async (htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) => {
      const width = options?.width || 800;

      // 截取页面为长图
      const image = await captureHtmlAsImage(htmlContent, notePath, width);

      // 根据文件扩展名决定格式
      const ext = path.extname(filePath).toLowerCase();
      let imageData: Buffer;

      if (ext === ".jpg" || ext === ".jpeg") {
        imageData = image.toJPEG(90);
      } else {
        imageData = image.toPNG();
      }

      await fs.writeFile(filePath, imageData);
    }, "EXPORT_IMAGE_FAILED")
  );

  // 复制 HTML 到剪贴板（用于微信公众号）
  ipcMain.handle("export:copy-html-to-clipboard", (_, htmlContent: string): IpcResultDTO<void> => {
    try {
      clipboard.writeHTML(htmlContent);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_COPY_CLIPBOARD_FAILED");
    }
  });

  // 导出 HTML 资源包（包含所有图片等资源和字体）
  ipcMain.handle(
    "export:export-html-package",
    wrapIpcHandler(
      async (htmlContent: string, outputPath: string, notePath: string | undefined, assetsFolder = "assets") => {
        // 创建输出目录和资源目录
        await fs.mkdir(outputPath, { recursive: true });
        const assetsDir = path.join(outputPath, assetsFolder);
        await fs.mkdir(assetsDir, { recursive: true });

        // 如果没有笔记路径，只复制字体文件
        if (!notePath) {
          const fontsDir = getFontsDir();
          const copiedFiles: string[] = [];
          for (const fontFile of Object.values(FONT_FILES)) {
            const sourcePath = path.join(fontsDir, fontFile);
            const destPath = path.join(assetsDir, fontFile);
            const copied = await fs.copyFile(sourcePath, destPath).then(
              () => true,
              () => false
            );
            if (copied) {
              copiedFiles.push(destPath);
            }
          }
          await fs.writeFile(path.join(outputPath, "index.html"), htmlContent, "utf-8");
          return { filesCount: copiedFiles.length + 1, copiedFiles };
        }

        // 收集并复制资源文件（包含字体）
        const { processedHtml, copiedFiles } = await collectAndCopyAssets(
          htmlContent,
          notePath,
          assetsDir,
          assetsFolder
        );

        // 保存处理后的 HTML
        await fs.writeFile(path.join(outputPath, "index.html"), processedHtml, "utf-8");

        return {
          filesCount: copiedFiles.length + 1,
          copiedFiles
        };
      },
      "EXPORT_HTML_PACKAGE_FAILED"
    )
  );

  // 导出为 PDF（分页）
  ipcMain.handle(
    "export:export-as-pdf-pages",
    wrapIpcHandler(async (htmlContents: string[], filePath: string, notePath?: string) => {
      // 创建一个 PDF 文档
      const pdfDoc = await PDFDocument.create();

      // 为每个分片生成图片并添加到 PDF
      for (let i = 0; i < htmlContents.length; i++) {
        const image = await captureHtmlAsImage(htmlContents[i], notePath);
        const pngData = image.toPNG();
        const pngImage = await pdfDoc.embedPng(pngData);

        // 添加新页面
        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngImage.width,
          height: pngImage.height
        });
      }

      // 保存为单个 PDF 文件
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(filePath, pdfBytes);

      return { pagesCount: htmlContents.length };
    }, "EXPORT_PDF_PAGES_FAILED")
  );

  // 导出为图片（分页）
  ipcMain.handle(
    "export:export-as-image-pages",
    wrapIpcHandler(
      async (
        htmlContents: string[],
        folderPath: string,
        baseFileName: string,
        notePath?: string,
        options?: { width?: number }
      ) => {
        await fs.mkdir(folderPath, { recursive: true });

        const width = options?.width || 800;
        const filePaths: string[] = [];

        for (let i = 0; i < htmlContents.length; i++) {
          const fileName = `${baseFileName}-${i + 1}.png`;
          const filePath = path.join(folderPath, fileName);

          // 截取页面为长图
          const image = await captureHtmlAsImage(htmlContents[i], notePath, width);
          const imageData = image.toPNG();

          await fs.writeFile(filePath, imageData);
          filePaths.push(filePath);
        }

        return { filesCount: filePaths.length, filePaths };
      },
      "EXPORT_IMAGE_PAGES_FAILED"
    )
  );
}
