import { BrowserWindow, dialog, app, clipboard } from "electron";
import { handleAppIpc, onAppIpc } from "../security/app-ipc";
import * as fs from "fs/promises";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import { wrapIpcHandler, wrapIpcHandlerWithEvent, ipcOk, ipcErr } from "../ipc/ipc-result";
import { isValidFileNameSegment, normalizeFileNameSegment, type IpcResultDTO } from "@shared";
import { captureHtmlAsImage } from "./capture";
import { collectAndCopyAssets, embedExportAssets, inspectExportAssets, renderHtmlExportPreview } from "./assets";
import { confirmClipboardWrite, reviewExportResources } from "./resource-review";
import { getCallerResourceToken, getCallerWorkspace, getCallerWorkspaceScope } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";
import { inspectExportDestination, writeExportDirectory, writeExportFile, type ExportDestination } from "./output";
import { initializeClipboardMonitor, watchClipboard, type ClipboardWatch } from "./clipboard-state";
import { renderClipboardEquations } from "./clipboard-equations";

interface ApprovedExportPath {
  destination: ExportDestination;
  language: "zh" | "en";
}

interface ClipboardCopyRequest {
  id: number;
  workspace: ReturnType<typeof getCallerWorkspaceScope>;
  notePath?: string;
  clipboard: ClipboardWatch;
  signal: AbortSignal;
}

interface PreparedClipboardWrite {
  id: number;
  frame: Electron.WebFrameMain;
  window: BrowserWindow;
  assertRequestCurrent: () => void;
  write: () => void;
}

const approvedExportPaths = new WeakMap<Electron.WebFrameMain, ApprovedExportPath>();

function waitForClipboardFocus(window: BrowserWindow, signal: AbortSignal): Promise<void> {
  if (signal.aborted || window.isDestroyed() || window.isFocused()) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      window.removeListener("focus", finish);
      window.removeListener("closed", finish);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, 5_000);
    window.once("focus", finish);
    window.once("closed", finish);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function takeApprovedExportPath(event: Electron.IpcMainInvokeEvent, filePath: string): ApprovedExportPath {
  const frame = event.senderFrame;
  const approved = frame && approvedExportPaths.get(frame);
  if (!frame || !approved || approved.destination.outputPath !== path.resolve(filePath)) {
    throw new Error("Export path was not selected by the application");
  }
  approvedExportPaths.delete(frame);
  return approved;
}

export function registerExportHandlers(): void {
  initializeClipboardMonitor();
  let latestClipboardCopy = 0;
  let clipboardCopyController: AbortController | undefined;
  let preparedClipboardWrite: PreparedClipboardWrite | undefined;
  const clipboardCopies = new WeakMap<Electron.WebFrameMain, ClipboardCopyRequest>();

  function discardPreparedClipboardWrite() {
    const prepared = preparedClipboardWrite;
    preparedClipboardWrite = undefined;
    prepared?.window.removeListener("closed", discardPreparedClipboardWrite);
    return prepared;
  }

  function advanceClipboardCopy() {
    const id = ++latestClipboardCopy;
    clipboardCopyController?.abort(new Error("USER_CANCELLED"));
    clipboardCopyController = undefined;
    const superseded = discardPreparedClipboardWrite();
    if (superseded && !superseded.frame.isDestroyed() && !superseded.frame.detached) {
      superseded.frame.send("export:clipboard-copy-superseded", superseded.id);
    }
    return id;
  }

  onAppIpc("export:native-clipboard-copy", advanceClipboardCopy);

  handleAppIpc(
    "export:confirm-clipboard-copy",
    wrapIpcHandlerWithEvent(async (event, requestId: number, confirmed: boolean) => {
      const prepared = preparedClipboardWrite;
      if (!prepared || prepared.id !== requestId || event.senderFrame !== prepared.frame) {
        throw new Error("USER_CANCELLED");
      }
      discardPreparedClipboardWrite();
      if (confirmed === false) return;
      if (confirmed !== true || prepared.window.isDestroyed() || !prepared.window.isFocused()) {
        throw new Error("USER_CANCELLED");
      }
      prepared.assertRequestCurrent();
      prepared.write();
    }, "EXPORT_COPY_CLIPBOARD_FAILED")
  );

  function assertClipboardCopyCurrent(
    event: Electron.IpcMainInvokeEvent,
    frame: Electron.WebFrameMain,
    requestId: number,
    workspace: ClipboardCopyRequest["workspace"]
  ) {
    if (requestId !== latestClipboardCopy || event.senderFrame !== frame) throw new Error("USER_CANCELLED");
    const current = getCallerWorkspaceScope(event);
    if (
      current.workspacePath !== workspace.workspacePath ||
      current.workspaceRevision !== workspace.workspaceRevision
    ) {
      throw new Error("USER_CANCELLED");
    }
  }

  function takeClipboardCopy(event: Electron.IpcMainInvokeEvent, requestId: number) {
    const frame = event.senderFrame;
    const request = frame && clipboardCopies.get(frame);
    if (!frame || !request || request.id !== requestId) throw new Error("USER_CANCELLED");
    clipboardCopies.delete(frame);

    const assertRequestCurrent = () => assertClipboardCopyCurrent(event, frame, requestId, request.workspace);
    const assertCurrent = async () => {
      assertRequestCurrent();
      if (!(await request.clipboard.unchanged())) throw new Error("USER_CANCELLED");
      assertRequestCurrent();
    };
    const writeClipboard = async (language: "zh" | "en", write: () => void) => {
      const window = request.clipboard.needsWindowFocus ? BrowserWindow.fromWebContents(event.sender) : undefined;
      if (request.clipboard.needsWindowFocus && (!window || window.isDestroyed())) throw new Error("USER_CANCELLED");
      if (request.clipboard.needsConfirmation) {
        await assertCurrent();
        if (window) {
          // Without a selection change signal, only a fresh action in the focused renderer can commit this copy.
          assertRequestCurrent();
          if (window.isDestroyed()) throw new Error("USER_CANCELLED");
          preparedClipboardWrite = { id: requestId, frame, window, assertRequestCurrent, write };
          window.once("closed", discardPreparedClipboardWrite);
          return "confirmation-required" as const;
        }
        await confirmClipboardWrite(event, language, request.signal);
      }
      assertRequestCurrent();
      if (window) {
        await waitForClipboardFocus(window, request.signal);
        if (window.isDestroyed() || !window.isFocused()) throw new Error("USER_CANCELLED");
      }
      await assertCurrent();
      if (window && (window.isDestroyed() || !window.isFocused())) throw new Error("USER_CANCELLED");
      assertRequestCurrent();
      write();
      return undefined;
    };
    return { ...request, assertRequestCurrent, assertCurrent, writeClipboard };
  }

  handleAppIpc(
    "export:show-save-dialog",
    wrapIpcHandlerWithEvent(
      async (
        event,
        options: {
          title: string;
          defaultPath: string;
          filters: Array<{ name: string; extensions: string[] }>;
          language?: "zh" | "en";
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
        const language =
          options.language === "zh" || options.language === "en"
            ? options.language
            : app.getLocale().startsWith("zh")
              ? "zh"
              : "en";
        const destination = await inspectExportDestination(path.resolve(result.filePath));
        approvedExportPaths.set(frame, { destination, language });
        return result.filePath;
      },
      "EXPORT_SHOW_SAVE_DIALOG_FAILED"
    )
  );

  handleAppIpc(
    "export:save-html-file",
    wrapIpcHandlerWithEvent(async (event, filePath: string, htmlContent: string) => {
      await writeExportFile(takeApprovedExportPath(event, filePath).destination, htmlContent);
    }, "EXPORT_SAVE_HTML_FAILED")
  );

  handleAppIpc(
    "export:prepare-html-preview",
    wrapIpcHandlerWithEvent(async (event, html: string, notePath: string | undefined, missingLabel: string) => {
      const workspace = getCallerWorkspaceScope(event);
      if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }
      const assets = await inspectExportAssets([html], notePath, workspace, "html");
      if (getCallerWorkspace(event) !== workspace.workspacePath) throw new Error("The export workspace changed");
      return renderHtmlExportPreview(html, assets, missingLabel, getCallerResourceToken(event));
    }, "EXPORT_PREVIEW_FAILED")
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
      const workspace = getCallerWorkspaceScope(event);
      const { destination, language } = takeApprovedExportPath(event, filePath);
      if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }
      const review = await reviewExportResources(event, [htmlContent], notePath, workspace, "capture", language);
      const image = await captureHtmlAsImage(htmlContent, notePath, 800, workspace, review);
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
        const workspace = getCallerWorkspaceScope(event);
        const { destination, language } = takeApprovedExportPath(event, filePath);
        if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const width = options?.width || 800;
        const review = await reviewExportResources(event, [htmlContent], notePath, workspace, "capture", language);
        const image = await captureHtmlAsImage(htmlContent, notePath, width, workspace, review);

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

  handleAppIpc(
    "export:copy-html-to-clipboard",
    wrapIpcHandlerWithEvent(async (event, requestId: number, htmlContent: string, language?: "zh" | "en") => {
      const { writeClipboard } = takeClipboardCopy(event, requestId);
      return writeClipboard(language === "zh" ? "zh" : "en", () => clipboard.writeHTML(htmlContent));
    }, "EXPORT_COPY_CLIPBOARD_FAILED")
  );

  handleAppIpc(
    "export:copy-text-to-clipboard",
    wrapIpcHandler(async (text: string) => {
      clipboard.writeText(text);
      advanceClipboardCopy();
    }, "EXPORT_COPY_CLIPBOARD_FAILED")
  );

  handleAppIpc(
    "export:begin-clipboard-copy",
    wrapIpcHandlerWithEvent(async (event, sourceWorkspace: string, notePath?: string) => {
      const frame = event.senderFrame;
      const workspace = getCallerWorkspaceScope(event);
      const roots = [workspace.workspacePath, workspace.scannedWorkspacePath];
      if (
        !frame ||
        typeof sourceWorkspace !== "string" ||
        !path.isAbsolute(sourceWorkspace) ||
        !roots.some((root) => root && path.relative(root, sourceWorkspace) === "")
      ) {
        throw new Error("USER_CANCELLED");
      }
      const id = advanceClipboardCopy();
      clipboardCopyController = new AbortController();
      const { signal } = clipboardCopyController;
      const clipboard = await watchClipboard();
      assertClipboardCopyCurrent(event, frame, id, workspace);
      if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }

      clipboardCopies.set(frame, { id, workspace, notePath, clipboard, signal });
      return id;
    }, "EXPORT_COPY_CLIPBOARD_FAILED")
  );

  handleAppIpc(
    "export:copy-full-text",
    wrapIpcHandlerWithEvent(
      async (event, requestId: number, markdown: string, htmlContent: string, language: "zh" | "en") => {
        const { workspace, notePath, signal, assertRequestCurrent, assertCurrent, writeClipboard } = takeClipboardCopy(
          event,
          requestId
        );
        const locale = language === "zh" ? "zh" : "en";
        await assertCurrent();
        const portableHtml = await renderClipboardEquations(htmlContent, assertRequestCurrent, signal);
        await assertCurrent();
        const { assets, includeExternal, missingLabel } = await reviewExportResources(
          event,
          [portableHtml],
          notePath,
          workspace,
          "clipboard",
          locale,
          { assertCurrent, signal }
        );
        const html = await embedExportAssets(portableHtml, assets, includeExternal, missingLabel, "clipboard", signal);
        return writeClipboard(locale, () => clipboard.write({ text: markdown, html }));
      },
      "EXPORT_COPY_CLIPBOARD_FAILED"
    )
  );

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
        const workspace = getCallerWorkspaceScope(event);
        const {
          destination: { outputPath },
          language
        } = takeApprovedExportPath(event, folderPath);
        if (!isValidFileNameSegment(assetsFolder)) {
          throw new Error("Invalid assets folder");
        }
        if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const review = await reviewExportResources(event, [htmlContent], notePath, workspace, "html", language);
        return writeExportDirectory(outputPath, async (stagingDirectory) => {
          const assetsDir = path.join(stagingDirectory, assetsFolder);
          await fs.mkdir(assetsDir);
          const { processedHtml, copiedFiles } = await collectAndCopyAssets(
            htmlContent,
            notePath,
            assetsDir,
            assetsFolder,
            workspace,
            review
          );
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
      const workspace = getCallerWorkspaceScope(event);
      const { destination, language } = takeApprovedExportPath(event, filePath);
      if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
        throw new Error("Note path is outside workspace");
      }
      const pdfDoc = await PDFDocument.create();
      const review = await reviewExportResources(event, htmlContents, notePath, workspace, "capture", language);

      for (let i = 0; i < htmlContents.length; i++) {
        const image = await captureHtmlAsImage(htmlContents[i], notePath, 800, workspace, review);
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
        const workspace = getCallerWorkspaceScope(event);
        const {
          destination: { outputPath },
          language
        } = takeApprovedExportPath(event, folderPath);
        if (notePath && !validatePathInWorkspace(workspace, notePath).isValid) {
          throw new Error("Note path is outside workspace");
        }
        const width = options?.width || 800;
        const safeBaseFileName = normalizeFileNameSegment(baseFileName) || "export";
        if (htmlContents.length === 0) throw new Error("No pages to export");
        const review = await reviewExportResources(event, htmlContents, notePath, workspace, "capture", language);
        return writeExportDirectory(outputPath, async (stagingDirectory) => {
          const filePaths: string[] = [];
          for (const [index, html] of htmlContents.entries()) {
            const fileName = `${safeBaseFileName}-${index + 1}.png`;
            const image = await captureHtmlAsImage(html, notePath, width, workspace, review);
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
