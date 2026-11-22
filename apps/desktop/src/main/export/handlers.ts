import { BrowserWindow, dialog, app, clipboard } from "electron";
import { handleAppIpc } from "../security/app-ipc";
import * as fs from "fs/promises";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import { wrapIpcHandlerWithEvent, ipcOk, ipcErr } from "../ipc/ipc-result";
import { isValidFileNameSegment, normalizeFileNameSegment, type IpcResultDTO } from "@shared";
import { captureHtmlAsImage } from "./capture";
import { collectAndCopyAssets } from "./assets";
import { getCallerWorkspace } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";
import { inspectExportDestination, writeExportDirectory, writeExportFile, type ExportDestination } from "./output";

const approvedExportPaths = new WeakMap<Electron.WebFrameMain, ExportDestination>();

function takeApprovedExportPath(event: Electron.IpcMainInvokeEvent, filePath: string): ExportDestination {
  const frame = event.senderFrame;
  const approved = frame && approvedExportPaths.get(frame);
  if (!frame || !approved || approved.outputPath !== path.resolve(filePath)) {
    throw new Error("Export path was not selected by the application");
  }
  approvedExportPaths.delete(frame);
  return approved;
}

export function registerExportHandlers(): void {
  handleAppIpc(
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
        const frame = event.senderFrame;
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!frame || !window) throw new Error("Cannot resolve caller window");
        approvedExportPaths.delete(frame);
        const result = await dialog.showSaveDialog(window, {
          title: options.title,
          defaultPath: options.defaultPath,
          filters: options.filters,
          properties: ["createDirectory", "showOverwriteConfirmation"]
        });

        if (result.canceled || !result.filePath) return null;
        approvedExportPaths.set(frame, await inspectExportDestination(path.resolve(result.filePath)));
        return result.filePath;
      },
      "EXPORT_SHOW_SAVE_DIALOG_FAILED"
    )
  );

  handleAppIpc(
    "export:save-html-file",
    wrapIpcHandlerWithEvent(async (event, filePath: string, htmlContent: string) => {
      await writeExportFile(takeApprovedExportPath(event, filePath), htmlContent);
    }, "EXPORT_SAVE_HTML_FAILED")
  );

  handleAppIpc("export:get-downloads-path", (): IpcResultDTO<string> => {
    try {
      return ipcOk(app.getPath("downloads"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_GET_DOWNLOADS_PATH_FAILED");
    }
  });

  handleAppIpc(
    "export:export-as-pdf",
    wrapIpcHandlerWithEvent(async (event, htmlContent: string, filePath: string, notePath?: string) => {
      const workspacePath = getCallerWorkspace(event);
      const destination = takeApprovedExportPath(event, filePath);
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
      await writeExportFile(destination, pdfBytes);
    }, "EXPORT_PDF_FAILED")
  );

  handleAppIpc(
    "export:export-as-image",
    wrapIpcHandlerWithEvent(
      async (event, htmlContent: string, filePath: string, notePath?: string, options?: { width?: number }) => {
        const workspacePath = getCallerWorkspace(event);
        const destination = takeApprovedExportPath(event, filePath);
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const width = options?.width || 800;
        const image = await captureHtmlAsImage(htmlContent, notePath, width, workspacePath);

        const ext = path.extname(destination.outputPath).toLowerCase();
        let imageData: Buffer;

        if (ext === ".jpg" || ext === ".jpeg") {
          imageData = image.toJPEG(90);
        } else {
          imageData = image.toPNG();
        }

        await writeExportFile(destination, imageData);
      },
      "EXPORT_IMAGE_FAILED"
    )
  );

  handleAppIpc("export:copy-html-to-clipboard", (_, htmlContent: string): IpcResultDTO<void> => {
    try {
      clipboard.writeHTML(htmlContent);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "EXPORT_COPY_CLIPBOARD_FAILED");
    }
  });

  handleAppIpc(
    "export:export-html-package",
    wrapIpcHandlerWithEvent(
      async (
        event: Electron.IpcMainInvokeEvent,
        htmlContent: string,
        folderPath: string,
        notePath: string | undefined,
        assetsFolder: string = "assets"
      ) => {
        const workspacePath = getCallerWorkspace(event);
        const { outputPath } = takeApprovedExportPath(event, folderPath);
        if (!isValidFileNameSegment(assetsFolder)) {
          throw new Error("Invalid assets folder");
        }
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        return writeExportDirectory(outputPath, async (stagingDirectory) => {
          const assetsDir = path.join(stagingDirectory, assetsFolder);
          await fs.mkdir(assetsDir);
          const { processedHtml, copiedFiles } = notePath
            ? await collectAndCopyAssets(htmlContent, notePath, assetsDir, assetsFolder, workspacePath)
            : { processedHtml: htmlContent, copiedFiles: [] };
          await fs.writeFile(path.join(stagingDirectory, "index.html"), processedHtml, "utf-8");
          return {
            filesCount: copiedFiles.length + 1,
            copiedFiles: copiedFiles.map((file) => path.join(outputPath, path.relative(stagingDirectory, file)))
          };
        });
      },
      "EXPORT_HTML_PACKAGE_FAILED"
    )
  );

  handleAppIpc(
    "export:export-as-pdf-pages",
    wrapIpcHandlerWithEvent(async (event, htmlContents: string[], filePath: string, notePath?: string) => {
      const workspacePath = getCallerWorkspace(event);
      const destination = takeApprovedExportPath(event, filePath);
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
      await writeExportFile(destination, pdfBytes);

      return { pagesCount: htmlContents.length };
    }, "EXPORT_PDF_PAGES_FAILED")
  );

  handleAppIpc(
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
        const { outputPath } = takeApprovedExportPath(event, folderPath);
        if (notePath && !validatePathInWorkspace(workspacePath, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const width = options?.width || 800;
        const safeBaseFileName = normalizeFileNameSegment(baseFileName) || "export";
        if (htmlContents.length === 0) throw new Error("No pages to export");
        return writeExportDirectory(outputPath, async (stagingDirectory) => {
          const filePaths: string[] = [];
          for (const [index, html] of htmlContents.entries()) {
            const fileName = `${safeBaseFileName}-${index + 1}.png`;
            const image = await captureHtmlAsImage(html, notePath, width, workspacePath);
            await fs.writeFile(path.join(stagingDirectory, fileName), image.toPNG());
            filePaths.push(path.join(outputPath, fileName));
          }
          return { filesCount: filePaths.length, filePaths };
        });
      },
      "EXPORT_IMAGE_PAGES_FAILED"
    )
  );
}
