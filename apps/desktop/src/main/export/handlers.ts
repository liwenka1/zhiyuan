import { ipcMain, dialog, app, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import { wrapIpcHandlerWithEvent, ipcOk, ipcErr } from "../ipc/ipc-result";
import { isValidFileNameSegment, normalizeFileNameSegment, type IpcResultDTO } from "@shared";
import { captureHtmlAsImage } from "./capture";
import { collectAndCopyAssets } from "./assets";
import { getCallerWorkspace, getCallerWindowId } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";

const approvedExportPaths = new Map<number, Set<string>>();

function approveExportPath(event: Electron.IpcMainInvokeEvent, filePath: string): void {
  const windowId = getCallerWindowId(event);
  const paths = approvedExportPaths.get(windowId) ?? new Set<string>();
  paths.add(path.resolve(filePath));
  approvedExportPaths.set(windowId, paths);
}

function assertApprovedExportPath(event: Electron.IpcMainInvokeEvent, filePath: string): void {
  const approved = approvedExportPaths.get(getCallerWindowId(event));
  if (!approved?.has(path.resolve(filePath))) {
    throw new Error("Export path was not selected by the application");
  }
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    "export:show-save-dialog",
    wrapIpcHandlerWithEvent(
      async (
        event,
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

        if (result.canceled || !result.filePath) return null;
        approveExportPath(event, result.filePath);
        return result.filePath;
      },
      "EXPORT_SHOW_SAVE_DIALOG_FAILED"
    )
  );

  ipcMain.handle(
    "export:save-html-file",
    wrapIpcHandlerWithEvent(async (event, filePath: string, htmlContent: string) => {
      assertApprovedExportPath(event, filePath);
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
    wrapIpcHandlerWithEvent(async (event, htmlContent: string, filePath: string, notePath?: string) => {
      const workspacePath = getCallerWorkspace(event);
      assertApprovedExportPath(event, filePath);
      if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }
      const image = await captureHtmlAsImage(htmlContent, notePath, 800, workspacePath);
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
    wrapIpcHandlerWithEvent(
      async (event, htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) => {
        const workspacePath = getCallerWorkspace(event);
        assertApprovedExportPath(event, filePath);
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const width = options?.width || 800;
        const image = await captureHtmlAsImage(htmlContent, notePath, width, workspacePath);

        const ext = path.extname(filePath).toLowerCase();
        let imageData: Buffer;

        if (ext === ".jpg" || ext === ".jpeg") {
          imageData = image.toJPEG(90);
        } else {
          imageData = image.toPNG();
        }

        await fs.writeFile(filePath, imageData);
      },
      "EXPORT_IMAGE_FAILED"
    )
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
    wrapIpcHandlerWithEvent(
      async (
        event: Electron.IpcMainInvokeEvent,
        htmlContent: string,
        outputPath: string,
        notePath: string | undefined,
        assetsFolder = "assets"
      ) => {
        const workspacePath = getCallerWorkspace(event);
        assertApprovedExportPath(event, outputPath);
        if (!isValidFileNameSegment(assetsFolder)) {
          throw new Error("Invalid assets folder");
        }
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
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
          assetsFolder,
          workspacePath
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
    wrapIpcHandlerWithEvent(async (event, htmlContents: string[], filePath: string, notePath?: string) => {
      const workspacePath = getCallerWorkspace(event);
      assertApprovedExportPath(event, filePath);
      if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < htmlContents.length; i++) {
        const image = await captureHtmlAsImage(htmlContents[i], notePath, 800, workspacePath);
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
    wrapIpcHandlerWithEvent(
      async (
        event: Electron.IpcMainInvokeEvent,
        htmlContents: string[],
        folderPath: string,
        baseFileName: string,
        notePath?: string,
        options?: { width?: number }
      ) => {
        const workspacePath = getCallerWorkspace(event);
        assertApprovedExportPath(event, folderPath);
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        await fs.mkdir(folderPath, { recursive: true });

        const width = options?.width || 800;
        const filePaths: string[] = [];
        const safeBaseFileName = normalizeFileNameSegment(baseFileName) || "export";

        for (let i = 0; i < htmlContents.length; i++) {
          const fileName = `${safeBaseFileName}-${i + 1}.png`;
          const filePath = path.join(folderPath, fileName);

          const image = await captureHtmlAsImage(htmlContents[i], notePath, width, workspacePath);
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
