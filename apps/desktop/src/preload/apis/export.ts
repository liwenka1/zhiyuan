import { ipcRenderer } from "electron";

export const exportApi = {
  /**
   * 将 Markdown 转换为 HTML
   * @param markdown Markdown 内容
   * @param notePath 可选，笔记的完整文件路径，用于将相对路径转换为绝对路径
   */
  markdownToHTML: (markdown: string, notePath?: string): Promise<string> =>
    ipcRenderer.invoke("export:markdown-to-html", markdown, notePath),

  /**
   * 显示保存对话框
   */
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null> => ipcRenderer.invoke("export:show-save-dialog", options),

  /**
   * 保存 HTML 文件
   */
  saveHTMLFile: (filePath: string, htmlContent: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("export:save-html-file", filePath, htmlContent),

  /**
   * 导出为 PDF
   * @param notePath 可选，笔记的完整文件路径，用于将相对路径的图片转换为 Base64
   */
  exportAsPDF: (htmlContent: string, filePath: string, notePath?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("export:export-as-pdf", htmlContent, filePath, notePath),

  /**
   * 导出为图片（单张长图）
   * @param notePath 可选，笔记的完整文件路径，用于将相对路径的图片转换为 Base64
   * @param options 可选配置，width 为图片宽度，默认 800
   */
  exportAsImage: (
    htmlContent: string,
    filePath: string,
    notePath?: string,
    options?: { width?: number }
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("export:export-as-image", htmlContent, filePath, notePath, options),

  /**
   * 获取用户下载目录
   */
  getDownloadsPath: (): Promise<string> => ipcRenderer.invoke("export:get-downloads-path"),

  /**
   * 将 HTML 中的 CSS 内联化（用于微信公众号）
   */
  inlineCSS: (htmlContent: string): Promise<string> => ipcRenderer.invoke("export:inline-css", htmlContent),

  /**
   * 复制 HTML 到剪贴板（用于微信公众号）
   */
  copyHTMLToClipboard: (htmlContent: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("export:copy-html-to-clipboard", htmlContent),

  /**
   * 导出 HTML 资源包（包含所有图片等资源）
   */
  exportHTMLPackage: (
    htmlContent: string,
    outputPath: string,
    notePath: string | undefined,
    assetsFolder?: string
  ): Promise<{
    filesCount: number;
    copiedFiles: string[];
  }> => ipcRenderer.invoke("export:export-html-package", htmlContent, outputPath, notePath, assetsFolder),

  /**
   * 导出为 PDF（分页）
   */
  exportAsPDFPages: (
    htmlContents: string[],
    filePath: string,
    notePath?: string
  ): Promise<{
    pagesCount: number;
  }> => ipcRenderer.invoke("export:export-as-pdf-pages", htmlContents, filePath, notePath),

  /**
   * 导出为图片（分页）
   */
  exportAsImagePages: (
    htmlContents: string[],
    folderPath: string,
    baseFileName: string,
    notePath?: string,
    options?: { width?: number }
  ): Promise<{
    filesCount: number;
    filePaths: string[];
  }> => ipcRenderer.invoke("export:export-as-image-pages", htmlContents, folderPath, baseFileName, notePath, options),

  /**
   * 获取字体文件的 base64 编码（用于 PDF/图片导出时内嵌字体）
   */
  getFontsBase64: (): Promise<{
    lxgwBase64: string;
    jetBrainsBase64: string;
  }> => ipcRenderer.invoke("export:get-fonts-base64")
};
