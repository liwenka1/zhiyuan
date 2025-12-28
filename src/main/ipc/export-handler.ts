import { ipcMain, dialog, app, BrowserWindow, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { pathToFileURL } from "url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import juice from "juice";

/**
 * 判断是否为相对路径
 */
function isRelativePath(src: string): boolean {
  if (!src) return false;
  // 排除协议路径和 data URI（包括自定义协议 local-resource）
  if (/^(https?:|data:|file:|blob:|#|mailto:|local-resource:)/.test(src)) return false;
  return true;
}

/**
 * 将 HTML 中的相对路径资源转换为绝对路径
 * 使用 pathToFileURL 正确处理中文路径和特殊字符
 * @param html HTML 内容
 * @param notePath 笔记的完整文件路径
 * @returns 转换后的 HTML
 */
function resolveHtmlResourcePaths(html: string, notePath: string): string {
  if (!notePath) return html;

  // 获取笔记所在目录
  const noteDir = path.dirname(notePath);

  // 匹配 src 和 href 属性中的路径
  // 支持: img src, video src, audio src, source src, a href, link href 等
  const attrRegex = /(src|href)=(["'])([^"']+)\2/gi;

  return html.replace(attrRegex, (match, attr, quote, url) => {
    if (isRelativePath(url)) {
      // 处理 ./xxx 格式
      const cleanUrl = url.replace(/^\.\//, "");
      // 使用 path.join 构建完整路径，再用 pathToFileURL 转换
      // 这样可以正确处理中文路径和特殊字符
      const fullPath = path.join(noteDir, cleanUrl);
      const fileUrl = pathToFileURL(fullPath).href;
      return `${attr}=${quote}${fileUrl}${quote}`;
    }
    return match;
  });
}

/**
 * 注册导出相关的 IPC handlers
 */
export function registerExportHandlers(): void {
  // Markdown 转 HTML
  // notePath 参数可选，用于将相对路径转换为绝对路径
  ipcMain.handle("export:markdown-to-html", async (_, markdown: string, notePath?: string) => {
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

      let html = String(file);

      // 如果提供了笔记路径，将相对路径转换为绝对路径
      if (notePath) {
        html = resolveHtmlResourcePaths(html, notePath);
      }

      return html;
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
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
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

  // 将 HTML 中的 CSS 内联化（用于微信公众号）
  ipcMain.handle("export:inline-css", async (_, htmlContent: string) => {
    try {
      // 使用 juice 将 <style> 标签中的 CSS 内联到 HTML 标签的 style 属性中
      const inlinedHtml = juice(htmlContent, {
        preserveMediaQueries: false,
        preserveFontFaces: false,
        removeStyleTags: true,
        applyStyleTags: true,
        applyWidthAttributes: false,
        applyHeightAttributes: false
      });

      return inlinedHtml;
    } catch (error) {
      console.error("CSS 内联化失败:", error);
      throw error;
    }
  });

  // 复制 HTML 到剪贴板（用于微信公众号）
  ipcMain.handle("export:copy-html-to-clipboard", async (_, htmlContent: string) => {
    try {
      // 将 HTML 内容写入剪贴板
      clipboard.writeHTML(htmlContent);
      return { success: true };
    } catch (error) {
      console.error("复制到剪贴板失败:", error);
      throw error;
    }
  });

  // 导出 HTML 资源包（包含所有图片等资源）
  ipcMain.handle(
    "export:export-html-package",
    async (
      _,
      htmlContent: string,
      outputPath: string,
      notePath: string | undefined,
      options: {
        packageType?: "folder" | "zip"; // 导出为文件夹还是 ZIP
        assetsFolder?: string; // 资源文件夹名称，默认 "assets"
      } = {}
    ) => {
      try {
        const packageType = options.packageType || "folder";
        const assetsFolder = options.assetsFolder || "assets";

        if (!notePath) {
          // 没有笔记路径，直接保存 HTML
          await fs.writeFile(outputPath, htmlContent, "utf-8");
          return { success: true, type: "single-file" };
        }

        // 1. 确定输出目录
        let outputDir: string;
        let needsZip = false;

        if (packageType === "zip") {
          // ZIP 模式：创建临时目录
          outputDir = path.join(app.getPath("temp"), `html-export-${Date.now()}`);
          needsZip = true;
        } else {
          // 文件夹模式：使用用户选择的路径作为目录
          outputDir = outputPath;
        }

        // 2. 创建输出目录和资源目录
        await fs.mkdir(outputDir, { recursive: true });
        const assetsDir = path.join(outputDir, assetsFolder);
        await fs.mkdir(assetsDir, { recursive: true });

        // 3. 收集并复制所有图片资源
        const { processedHtml, copiedFiles } = await collectAndCopyAssets(
          htmlContent,
          notePath,
          assetsDir,
          assetsFolder
        );

        // 4. 保存 HTML 文件
        const htmlFilePath = path.join(outputDir, "index.html");
        await fs.writeFile(htmlFilePath, processedHtml, "utf-8");

        // 5. 如果需要，创建 ZIP 文件
        if (needsZip) {
          // 这里需要一个 ZIP 库，我们先用简单的方式
          // 实际项目中建议使用 archiver 或 jszip
          console.log("ZIP 功能需要额外的库支持");
          // TODO: 实现 ZIP 压缩
        }

        return {
          success: true,
          type: packageType,
          outputPath: packageType === "zip" ? outputPath : outputDir,
          filesCount: copiedFiles.length + 1, // +1 for HTML file
          copiedFiles
        };
      } catch (error) {
        console.error("导出 HTML 资源包失败:", error);
        throw error;
      }
    }
  );
}

/**
 * 收集并复制所有资源文件
 * @returns 处理后的 HTML 和已复制的文件列表
 */
async function collectAndCopyAssets(
  html: string,
  notePath: string,
  assetsDir: string,
  assetsFolderName: string
): Promise<{ processedHtml: string; copiedFiles: string[] }> {
  const noteDir = path.dirname(notePath);
  const copiedFiles: string[] = [];
  const fileMap = new Map<string, string>(); // 原路径 -> 新路径

  // 匹配所有资源标签的 src/href 属性
  const resourceRegex = /<(img|video|audio|source)[^>]+(src|href)=(["'])([^"']+)\3[^>]*>/gi;

  const promises: Promise<void>[] = [];
  const matches = html.matchAll(resourceRegex);

  for (const match of matches) {
    const src = match[4]; // 资源路径

    // 只处理相对路径和 file:// 协议
    if (isRelativePath(src) || src.startsWith("file://")) {
      promises.push(
        (async () => {
          try {
            let sourcePath: string;

            if (src.startsWith("file://")) {
              sourcePath = decodeURIComponent(src.replace(/^file:\/\//, ""));
            } else {
              const cleanSrc = src.replace(/^\.\//, "");
              sourcePath = path.join(noteDir, cleanSrc);
            }

            // 检查文件是否存在
            try {
              await fs.access(sourcePath);
            } catch {
              console.warn(`资源文件不存在: ${sourcePath}`);
              return;
            }

            // 生成新的文件名（保持原扩展名）
            const ext = path.extname(sourcePath);
            const basename = path.basename(sourcePath, ext);
            const newFileName = `${basename}${ext}`;

            // 复制文件到 assets 目录
            const destPath = path.join(assetsDir, newFileName);

            // 如果文件名冲突，添加序号
            let counter = 1;
            let finalDestPath = destPath;
            while (copiedFiles.includes(finalDestPath)) {
              const newName = `${basename}-${counter}${ext}`;
              finalDestPath = path.join(assetsDir, newName);
              counter++;
            }

            await fs.copyFile(sourcePath, finalDestPath);
            copiedFiles.push(finalDestPath);

            // 记录映射关系（相对路径）
            const relativePath = `./${assetsFolderName}/${path.basename(finalDestPath)}`;
            fileMap.set(src, relativePath);
          } catch (error) {
            console.error(`复制资源失败: ${src}`, error);
          }
        })()
      );
    }
  }

  // 等待所有文件复制完成
  await Promise.all(promises);

  // 替换 HTML 中的路径
  let processedHtml = html;
  fileMap.forEach((newPath, oldPath) => {
    // 转义特殊字符
    const escapedOldPath = oldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escapedOldPath, "g");
    processedHtml = processedHtml.replace(regex, newPath);
  });

  return { processedHtml, copiedFiles };
}
