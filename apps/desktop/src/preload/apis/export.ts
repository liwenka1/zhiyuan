import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export function observeNativeClipboardCopies(target: Window): void {
  const notify = (event: Event) => {
    if (event.isTrusted) ipcRenderer.send("export:native-clipboard-copy");
  };
  target.addEventListener("copy", notify, true);
  target.addEventListener("cut", notify, true);
}

export const exportApi = {
  /**
   * 显示保存对话框
   */
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
    language?: "zh" | "en";
  }): Promise<IpcResultDTO<string | null>> => ipcRenderer.invoke("export:show-save-dialog", options),

  /**
   * 保存 HTML 文件
   */
  saveHTMLFile: (filePath: string, htmlContent: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("export:save-html-file", filePath, htmlContent),

  prepareHtmlPreview: (
    html: string,
    notePath: string | undefined,
    missingLabel: string
  ): Promise<IpcResultDTO<string>> => ipcRenderer.invoke("export:prepare-html-preview", html, notePath, missingLabel),

  /**
   * 导出为 PDF
   * @param notePath 可选，笔记的完整文件路径，用于将相对路径的图片转换为 Base64
   */
  exportAsPDF: (htmlContent: string, filePath: string, notePath?: string): Promise<IpcResultDTO<void>> =>
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
  ): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("export:export-as-image", htmlContent, filePath, notePath, options),

  /**
   * 获取用户下载目录
   */
  getDownloadsPath: (): Promise<IpcResultDTO<string>> => ipcRenderer.invoke("export:get-downloads-path"),

  /**
   * 复制 HTML 到剪贴板（用于微信公众号）
   */
  copyHTMLToClipboard: (
    requestId: number,
    htmlContent: string,
    language?: "zh" | "en"
  ): Promise<IpcResultDTO<"confirmation-required" | undefined>> =>
    ipcRenderer.invoke("export:copy-html-to-clipboard", requestId, htmlContent, language),

  copyTextToClipboard: (text: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("export:copy-text-to-clipboard", text),

  beginClipboardCopy: (workspacePath: string, notePath?: string): Promise<IpcResultDTO<number>> =>
    ipcRenderer.invoke("export:begin-clipboard-copy", workspacePath, notePath),

  copyFullText: (
    requestId: number,
    markdown: string,
    htmlContent: string,
    language: "zh" | "en"
  ): Promise<IpcResultDTO<"confirmation-required" | undefined>> =>
    ipcRenderer.invoke("export:copy-full-text", requestId, markdown, htmlContent, language),

  confirmClipboardCopy: (requestId: number, confirmed: boolean): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("export:confirm-clipboard-copy", requestId, confirmed),

  onClipboardCopySuperseded: (callback: (requestId: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: number) => callback(requestId);
    ipcRenderer.on("export:clipboard-copy-superseded", listener);
    return () => ipcRenderer.removeListener("export:clipboard-copy-superseded", listener);
  },

  /**
   * 导出 HTML 资源包（包含所有图片等资源）
   */
  exportHTMLPackage: (
    htmlContent: string,
    outputPath: string,
    notePath: string | undefined,
    assetsFolder?: string
  ): Promise<
    IpcResultDTO<{
      filesCount: number;
      copiedFiles: string[];
    }>
  > => ipcRenderer.invoke("export:export-html-package", htmlContent, outputPath, notePath, assetsFolder),

  /**
   * 导出为 PDF（分页）
   */
  exportAsPDFPages: (
    htmlContents: string[],
    filePath: string,
    notePath?: string
  ): Promise<
    IpcResultDTO<{
      pagesCount: number;
    }>
  > => ipcRenderer.invoke("export:export-as-pdf-pages", htmlContents, filePath, notePath),

  /**
   * 导出为图片（分页）
   */
  exportAsImagePages: (
    htmlContents: string[],
    folderPath: string,
    baseFileName: string,
    notePath?: string,
    options?: { width?: number }
  ): Promise<
    IpcResultDTO<{
      filesCount: number;
      filePaths: string[];
    }>
  > => ipcRenderer.invoke("export:export-as-image-pages", htmlContents, folderPath, baseFileName, notePath, options)
};
