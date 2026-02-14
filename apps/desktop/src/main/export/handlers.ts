import { ipcMain, dialog, app, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import { wrapIpcHandler, ipcOk, ipcErr } from "../ipc/ipc-result";
import type { IpcResultDTO } from "@shared";
import { captureHtmlAsImage } from "./capture";
import { collectAndCopyAssets } from "./assets";

export function registerExportHandlers(): void {
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

  ipcMain.handle(
    "export:save-html-file",
    wrapIpcHandler(async (filePath: string, htmlContent: string) => {
      await fs.writeFile(filePath, htmlContent, "utf-8");
    }, "EXPORT_SAVE_HTML_FAILED")
  );

  ipcMain.handle("export:get-downloads-path", (): IpcResultDTO<string> => {
    try {
      return ipcOk(app.getPath("downloads"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_GET_DOWNLOADS_PATH_FAILED");
    }
  });

  ipcMain.handle(
    "export:export-as-pdf",
    wrapIpcHandler(async (htmlContent: string, filePath: string, notePath?: string) => {
      const image = await captureHtmlAsImage(htmlContent, notePath);
      const pngData = image.toPNG();

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngData);

      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);

      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height
      });

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(filePath, pdfBytes);
    }, "EXPORT_PDF_FAILED")
  );

  ipcMain.handle(
    "export:export-as-image",
    wrapIpcHandler(async (htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) => {
      const width = options?.width || 800;
      const image = await captureHtmlAsImage(htmlContent, notePath, width);

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

  ipcMain.handle("export:copy-html-to-clipboard", (_, htmlContent: string): IpcResultDTO<void> => {
    try {
      clipboard.writeHTML(htmlContent);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_COPY_CLIPBOARD_FAILED");
    }
  });

  ipcMain.handle(
    "export:export-html-package",
    wrapIpcHandler(
      async (htmlContent: string, outputPath: string, notePath: string | undefined, assetsFolder = "assets") => {
        await fs.mkdir(outputPath, { recursive: true });
        const assetsDir = path.join(outputPath, assetsFolder);
        await fs.mkdir(assetsDir, { recursive: true });

        if (!notePath) {
          await fs.writeFile(path.join(outputPath, "index.html"), htmlContent, "utf-8");
          return { filesCount: 1, copiedFiles: [] };
        }

        const { processedHtml, copiedFiles } = await collectAndCopyAssets(
          htmlContent,
          notePath,
          assetsDir,
          assetsFolder
        );

        await fs.writeFile(path.join(outputPath, "index.html"), processedHtml, "utf-8");

        return {
          filesCount: copiedFiles.length + 1,
          copiedFiles
        };
      },
      "EXPORT_HTML_PACKAGE_FAILED"
    )
  );

  ipcMain.handle(
    "export:export-as-pdf-pages",
    wrapIpcHandler(async (htmlContents: string[], filePath: string, notePath?: string) => {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < htmlContents.length; i++) {
        const image = await captureHtmlAsImage(htmlContents[i], notePath);
        const pngData = image.toPNG();
        const pngImage = await pdfDoc.embedPng(pngData);

        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngImage.width,
          height: pngImage.height
        });
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(filePath, pdfBytes);

      return { pagesCount: htmlContents.length };
    }, "EXPORT_PDF_PAGES_FAILED")
  );

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
