/**
 * Export IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";

export const exportIpc = {
  showSaveDialog: async (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => unwrapIpcResult(await window.api.export.showSaveDialog(options)),

  saveHTMLFile: async (filePath: string, htmlContent: string) =>
    unwrapIpcResult(await window.api.export.saveHTMLFile(filePath, htmlContent)),

  exportAsPDF: async (htmlContent: string, filePath: string, notePath?: string) =>
    unwrapIpcResult(await window.api.export.exportAsPDF(htmlContent, filePath, notePath)),

  exportAsImage: async (htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) =>
    unwrapIpcResult(await window.api.export.exportAsImage(htmlContent, filePath, notePath, options)),

  getDownloadsPath: async () => unwrapIpcResult(await window.api.export.getDownloadsPath()),

  copyHTMLToClipboard: async (htmlContent: string) =>
    unwrapIpcResult(await window.api.export.copyHTMLToClipboard(htmlContent)),

  exportHTMLPackage: async (
    htmlContent: string,
    outputPath: string,
    notePath: string | undefined,
    assetsFolder?: string
  ) => unwrapIpcResult(await window.api.export.exportHTMLPackage(htmlContent, outputPath, notePath, assetsFolder)),

  exportAsPDFPages: async (htmlContents: string[], filePath: string, notePath?: string) =>
    unwrapIpcResult(await window.api.export.exportAsPDFPages(htmlContents, filePath, notePath)),

  exportAsImagePages: async (
    htmlContents: string[],
    folderPath: string,
    baseFileName: string,
    notePath?: string,
    options?: { width?: number }
  ) =>
    unwrapIpcResult(
      await window.api.export.exportAsImagePages(htmlContents, folderPath, baseFileName, notePath, options)
    )
};
