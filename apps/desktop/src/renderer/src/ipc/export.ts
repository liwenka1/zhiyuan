/**
 * Export IPC wrapper
 */

import { unwrapIpcResult } from "@/lib/ipc-utils";
import { useLanguageStore } from "@/stores/use-language-store";

export const exportIpc = {
  showSaveDialog: async (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) =>
    unwrapIpcResult(
      await window.api.export.showSaveDialog({ ...options, language: useLanguageStore.getState().language })
    ),

  saveHTMLFile: async (filePath: string, htmlContent: string) =>
    unwrapIpcResult(await window.api.export.saveHTMLFile(filePath, htmlContent)),

  prepareHtmlPreview: async (html: string, notePath: string | undefined, missingLabel: string) =>
    unwrapIpcResult(await window.api.export.prepareHtmlPreview(html, notePath, missingLabel)),

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
