import { shell, BrowserWindow, app, dialog } from "electron";
import { handleAppIpc } from "../security/app-ipc";
import fs from "fs";
import path from "path";
import { workspaceManager } from "../workspace";
import { FileContentConflictError, fileSystem } from "../file-system";
import { writeExistingFile } from "../file-system/guarded-write";
import { writeStagedFile } from "../file-system/staged-output";
import { fileWatcherManager } from "../file-watcher";
import { windowManager } from "../window-manager";
import { configManager } from "../config";
import { isSafeUrl, getRejectedProtocol } from "../security/url-validator";
import { validatePathInWorkspace } from "../security/path-validator";
import { getCallerWorkspace, getCallerWorkspaceScope } from "../security/window-context";
import { isExternalNoteFile, resolveLocalRegularFile } from "../security/local-file";
import { wrapIpcHandler, wrapIpcHandlerWithEvent, ipcOk, ipcErr } from "./ipc-result";
import {
  normalizeExportLayoutConfig,
  findShortcutConflicts,
  getReservedMenuShortcuts,
  getShortcutBindingKey,
  type ExportLayoutConfig,
  type IpcResultDTO,
  type ShortcutBinding,
  type ShortcutConfig,
  type ShortcutId,
  DEFAULT_SHORTCUTS,
  type GitHubConfig,
  type GitHubProjectConfigMap,
  isValidFileNameSegment,
  isValidWorkspaceEntryName
} from "@shared";
import { isIgnoredWorkspaceDirectory } from "../workspace/policy";
import { registerWatcherHandlers } from "./watcher-handler";
import { publicationLeases } from "../github/publication-leases";
import { findOpenTargetWindow, focusAndSendExternalOpen } from "../external-open";
import { resolveMarkdownOpenTarget, type MarkdownOpenTarget } from "../workspace/open-target";

const pendingWorkspaceScans = new Map<number, symbol>();

function cancelWorkspaceScan(windowId: number): void {
  pendingWorkspaceScans.delete(windowId);
}

/**
 * 校验文件路径是否在当前窗口的工作区内
 * 通过 event.sender 获取窗口绑定的工作区路径
 */
function assertPathInWorkspace(event: Electron.IpcMainInvokeEvent, filePath: string, operation: string): string {
  const entry = windowManager.getEntryByWebContents(event.sender);
  const workspacePath = entry?.workspacePath;
  if (!workspacePath) {
    throw new Error("No workspace selected");
  }

  const validation = validatePathInWorkspace(
    { workspacePath, scannedWorkspacePath: entry.scannedWorkspacePath },
    filePath
  );
  if (!validation.isValid) {
    if (validation.code === "ENOTDIR") {
      throw Object.assign(new Error("The note's parent path is no longer a directory"), { code: validation.code });
    }
    throw new Error(`Access denied (${operation}): path is outside workspace`);
  }
  return validation.normalizedPath;
}

function getWorkspaceEntryPath(event: Electron.IpcMainInvokeEvent, filePath: string, operation: string): string {
  assertPathInWorkspace(event, filePath, operation);
  const absolutePath = path.resolve(filePath);
  const parent = assertPathInWorkspace(event, path.dirname(absolutePath), operation);
  // Keep the requested final name, including casing on a case-only rename.
  return path.join(parent, path.basename(absolutePath));
}

function assertWorkspaceAvailable(event: Electron.IpcMainInvokeEvent): void {
  if (!fs.statSync(getCallerWorkspace(event)).isDirectory()) {
    throw Object.assign(new Error("The workspace directory is no longer available"), { code: "ENOTDIR" });
  }
}

function isMissingFileError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
}

function getCallerWorkspaceRoot(event: Electron.IpcMainInvokeEvent): string {
  const workspacePath = getCallerWorkspace(event);
  return validatePathInWorkspace(workspacePath, workspacePath).normalizedPath;
}

function getWorkspaceRelativePath(event: Electron.IpcMainInvokeEvent, targetPath: string, operation: string): string {
  return path.relative(getCallerWorkspaceRoot(event), assertPathInWorkspace(event, targetPath, operation));
}

function assertNotWorkspaceRoot(event: Electron.IpcMainInvokeEvent, targetPath: string, operation: string): void {
  if (getWorkspaceRelativePath(event, targetPath, operation) === "") {
    throw new Error(`Access denied (${operation}): workspace root cannot be modified`);
  }
}

function assertWorkspaceFolderPath(
  event: Electron.IpcMainInvokeEvent,
  folderPath: string,
  operation: string,
  allowMissing = false
): string {
  const relativePath = getWorkspaceRelativePath(event, folderPath, operation);
  const segments = relativePath.split(path.sep).filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => !isValidFileNameSegment(segment))) {
    throw new Error(`Access denied (${operation}): only valid workspace folders are allowed`);
  }
  if (segments.some((segment) => isIgnoredWorkspaceDirectory(segment))) {
    throw new Error(`Access denied (${operation}): generated or hidden folders are not allowed`);
  }
  const authorizedPath = getWorkspaceEntryPath(event, folderPath, operation);
  if (!allowMissing) {
    const stat = fs.lstatSync(authorizedPath);
    if (!stat.isDirectory()) throw new Error(`Access denied (${operation}): target is not a directory`);
  }
  return authorizedPath;
}

async function resolveDroppedMarkdownPath(filePath: string): Promise<string> {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !filePath.toLowerCase().endsWith(".md")) {
    throw new Error("Only markdown files can be opened");
  }
  const resolved = await fs.promises.realpath(filePath);
  if (!resolved.toLowerCase().endsWith(".md") || !(await fs.promises.stat(resolved)).isFile()) {
    throw new Error("Invalid markdown file");
  }
  return resolved;
}

function assertRegularFilePath(filePath: string, operation: string): void {
  const stat = fs.lstatSync(filePath);
  if (stat.isDirectory()) throw Object.assign(new Error("Target is a directory"), { code: "EISDIR" });
  if (!stat.isFile()) throw new Error(`Access denied (${operation}): target is not a regular file`);
}

/**
 * 从 event 获取调用窗口的 BrowserWindow 实例，找不到则抛出错误
 */
function getCallerWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    throw new Error("Cannot resolve caller window");
  }
  return win;
}

function routeMarkdownOpen(win: BrowserWindow, target: MarkdownOpenTarget): MarkdownOpenTarget | null {
  const existing = findOpenTargetWindow(target);
  const workspacePath = existing?.payload.workspacePath ?? target.workspacePath;
  configManager.addRecentWorkspace(workspacePath);
  if (existing && existing.window.id !== win.id) {
    focusAndSendExternalOpen(existing.window, existing.payload);
    return null;
  }
  return { workspacePath, filePath: existing?.payload.filePath ?? target.filePath };
}

function isApprovedWorkspacePath(workspacePath: string): boolean {
  const normalize = (candidate: string) => {
    try {
      return fs.realpathSync.native(candidate);
    } catch {
      return path.resolve(candidate);
    }
  };
  const normalized = normalize(workspacePath);
  if (configManager.getRecentWorkspaces().some((recent) => normalize(recent) === normalized)) {
    return true;
  }
  return windowManager
    .getAllEntries()
    .some((entry) => entry.workspacePath && normalize(entry.workspacePath) === normalized);
}

async function copyImportedMarkdown(
  event: Electron.IpcMainInvokeEvent,
  sourcePath: string,
  targetDir: string,
  fileName: string
): Promise<string> {
  const { name, ext } = path.parse(fileName);
  for (let index = 0; index < 10_000; index++) {
    const candidate = path.join(targetDir, index === 0 ? fileName : `${name} (${index})${ext}`);
    assertPathInWorkspace(event, candidate, "workspace:importMarkdownFiles (candidate)");
    try {
      await fs.promises.copyFile(sourcePath, candidate, fs.constants.COPYFILE_EXCL);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("Cannot resolve unique target file name");
}

/**
 * 注册工作区和文件系统相关的 IPC 处理器
 */
export function registerWorkspaceHandlers(): void {
  // 选择工作区
  handleAppIpc(
    "workspace:select",
    wrapIpcHandlerWithEvent(async (event, options?: { title?: string; buttonLabel?: string }) => {
      const win = getCallerWindow(event);
      const workspacePath = await workspaceManager.selectWorkspace(win, options);
      if (workspacePath) {
        // 如果其他窗口已打开该工作区，聚焦过去，当前窗口不变
        if (windowManager.focusExistingWindow(workspacePath, win.id)) {
          return null;
        }
      }
      return workspacePath;
    }, "WORKSPACE_SELECT_FAILED")
  );

  // 获取当前窗口的工作区
  handleAppIpc("workspace:getCurrent", (event): IpcResultDTO<string | null> => {
    try {
      const entry = windowManager.getEntryByWebContents(event.sender);
      return ipcOk(entry?.workspacePath ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_CURRENT_FAILED");
    }
  });

  handleAppIpc(
    "workspace:begin-switch",
    wrapIpcHandlerWithEvent(async (event, workspacePath: string | null) => {
      windowManager.beginWorkspaceSwitch(getCallerWindow(event).id, workspacePath);
    }, "WORKSPACE_SWITCH_FAILED")
  );

  // 扫描工作区
  handleAppIpc(
    "workspace:scan",
    wrapIpcHandlerWithEvent(async (event, workspacePath: string) => {
      const win = getCallerWindow(event);
      if (typeof workspacePath !== "string" || !workspacePath.trim()) {
        throw new Error("Invalid workspace path");
      }
      if (!isApprovedWorkspacePath(workspacePath)) {
        throw new Error("Workspace path was not selected by the application");
      }
      windowManager.beginWorkspaceSwitch(win.id, workspacePath);
      cancelWorkspaceScan(win.id);
      // 如果其他窗口已打开该工作区，聚焦过去，当前窗口返回 null
      if (windowManager.focusExistingWindow(workspacePath, win.id)) {
        return null;
      }
      const scanToken = Symbol("workspace-scan");
      pendingWorkspaceScans.set(win.id, scanToken);
      try {
        const data = await workspaceManager.scanWorkspace(workspacePath);
        if (pendingWorkspaceScans.get(win.id) !== scanToken || win.isDestroyed()) return null;
        // 只有扫描成功后才绑定工作区并启动文件监听。
        windowManager.setWorkspacePath(win.id, workspacePath);
        fileWatcherManager.startWatching(workspacePath, win.id);
        return data;
      } finally {
        if (pendingWorkspaceScans.get(win.id) === scanToken) {
          pendingWorkspaceScans.delete(win.id);
        }
      }
    }, "WORKSPACE_SCAN_FAILED")
  );

  // 欢迎页拖入 Markdown 时，文件夹尚未进入“最近工作区”，先由主进程验证并批准该目录。
  handleAppIpc(
    "workspace:approveDroppedFile",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      if (typeof filePath !== "string" || !path.isAbsolute(filePath)) throw new Error("Invalid dropped file path");
      return routeMarkdownOpen(getCallerWindow(event), resolveMarkdownOpenTarget(filePath));
    }, "WORKSPACE_APPROVE_DROPPED_FILE_FAILED")
  );

  registerWatcherHandlers();

  // 打开文件
  handleAppIpc(
    "workspace:openFile",
    wrapIpcHandlerWithEvent(async (event, options?: { title?: string; buttonLabel?: string }) => {
      const win = getCallerWindow(event);
      const result = await workspaceManager.openFile(win, options);
      return result ? routeMarkdownOpen(win, result) : null;
    }, "WORKSPACE_OPEN_FILE_FAILED")
  );

  // 获取最近打开的工作区
  handleAppIpc("workspace:getRecent", (): IpcResultDTO<string[]> => {
    try {
      return ipcOk(workspaceManager.getRecentWorkspaces());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "WORKSPACE_GET_RECENT_FAILED");
    }
  });

  // 导入外部 Markdown 文件到工作区内目标目录
  handleAppIpc(
    "workspace:importMarkdownFiles",
    wrapIpcHandlerWithEvent(async (event, sourcePaths: string[], targetDir: string) => {
      const authorizedTargetDir = assertPathInWorkspace(event, targetDir, "workspace:importMarkdownFiles (targetDir)");
      if (!Array.isArray(sourcePaths)) {
        throw new Error("Invalid sourcePaths");
      }

      const importedPaths: string[] = [];
      let skippedCount = 0;

      await fs.promises.mkdir(authorizedTargetDir, { recursive: true });

      for (const sourcePath of sourcePaths) {
        try {
          if (typeof sourcePath !== "string" || !sourcePath.toLowerCase().endsWith(".md")) {
            skippedCount += 1;
            continue;
          }

          const fileName = path.basename(sourcePath);
          if (!isValidWorkspaceEntryName(fileName)) {
            skippedCount += 1;
            continue;
          }

          const authorizedSource = await resolveDroppedMarkdownPath(sourcePath);

          const targetPath = await copyImportedMarkdown(event, authorizedSource, authorizedTargetDir, fileName);
          // The renderer derives note IDs from the workspace path used by its scan.
          importedPaths.push(path.join(targetDir, path.basename(targetPath)));
        } catch {
          skippedCount += 1;
        }
      }

      return {
        importedCount: importedPaths.length,
        skippedCount,
        importedPaths
      };
    }, "WORKSPACE_IMPORT_MARKDOWN_FILES_FAILED")
  );

  // 从应用拖出文件到系统（Copy-out）
  handleAppIpc(
    "workspace:startDragOut",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      const authorizedPath = assertPathInWorkspace(event, filePath, "workspace:startDragOut");
      if (!authorizedPath.toLowerCase().endsWith(".md")) {
        throw new Error("Only markdown file drag-out is supported");
      }
      const stat = await fs.promises.stat(authorizedPath);
      if (!stat.isFile()) {
        throw new Error("Invalid file to drag out");
      }

      const icon = await app.getFileIcon(authorizedPath, { size: "normal" });
      event.sender.startDrag({
        file: authorizedPath,
        icon
      });
    }, "WORKSPACE_START_DRAG_OUT_FAILED")
  );

  // 读取文件（校验路径在工作区内）
  handleAppIpc("file:read", async (event, filePath: string) => {
    try {
      assertWorkspaceAvailable(event);
      const authorizedPath = getWorkspaceEntryPath(event, filePath, "file:read");
      assertRegularFilePath(authorizedPath, "file:read");
      return ipcOk(await fileSystem.readFile(authorizedPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, isMissingFileError(error) ? "FILE_NOT_FOUND" : "FILE_READ_FAILED", error);
    }
  });

  // 写入文件（校验路径在工作区内）
  handleAppIpc("file:write", async (event, filePath: string, content: string, expectedContent?: string) => {
    try {
      if (typeof content !== "string" || (expectedContent !== undefined && typeof expectedContent !== "string")) {
        throw new Error("Invalid file content");
      }
      assertWorkspaceAvailable(event);
      assertNotWorkspaceRoot(event, filePath, "file:write");
      const authorizedPath = getWorkspaceEntryPath(event, filePath, "file:write");
      assertRegularFilePath(authorizedPath, "file:write");
      return ipcOk(await writeExistingFile(authorizedPath, content, expectedContent));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof FileContentConflictError) return ipcErr(message, "FILE_CONTENT_CONFLICT", error);
      if (isMissingFileError(error)) return ipcErr(message, "FILE_NOT_FOUND", error);
      return ipcErr(message, "FILE_WRITE_FAILED", error);
    }
  });

  // 创建文件（校验路径在工作区内）
  handleAppIpc(
    "file:create",
    wrapIpcHandlerWithEvent(async (event, filePath: string, content: string) => {
      const authorizedPath = getWorkspaceEntryPath(event, filePath, "file:create");
      return await fileSystem.createFile(authorizedPath, content);
    }, "FILE_CREATE_FAILED")
  );

  handleAppIpc(
    "file:saveDraftAs",
    wrapIpcHandlerWithEvent(
      async (
        event,
        suggestedName: string,
        content: string,
        title: string,
        existingFileMessage = "This file already exists. Choose a new name for the recovered draft."
      ) => {
        if (
          typeof suggestedName !== "string" ||
          typeof content !== "string" ||
          typeof title !== "string" ||
          typeof existingFileMessage !== "string"
        ) {
          throw new Error("Invalid draft");
        }
        const fileName = isValidFileNameSegment(suggestedName) ? suggestedName : "Recovered draft.md";
        const window = getCallerWindow(event);
        let defaultPath = path.join(app.getPath("documents"), fileName);
        for (;;) {
          const result = await dialog.showSaveDialog(window, {
            title,
            defaultPath,
            filters: [{ name: "Markdown", extensions: ["md"] }],
            properties: ["createDirectory"]
          });
          if (result.canceled || !result.filePath) return false;
          try {
            await writeStagedFile(result.filePath, content);
            return true;
          } catch (error) {
            if ((error as NodeJS.ErrnoException | null)?.code !== "EEXIST") throw error;
            await dialog.showMessageBox(window, { type: "info", title, message: existingFileMessage });
            defaultPath = path.join(path.dirname(result.filePath), fileName);
          }
        }
      },
      "FILE_SAVE_DRAFT_FAILED"
    )
  );

  // 删除文件（校验路径在工作区内）
  handleAppIpc(
    "file:delete",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      assertNotWorkspaceRoot(event, filePath, "file:delete");
      const authorizedPath = getWorkspaceEntryPath(event, filePath, "file:delete");
      assertRegularFilePath(authorizedPath, "file:delete");
      const sourcePath = fs.realpathSync.native(authorizedPath);
      const finishChange = publicationLeases.beginPathChange(sourcePath);
      try {
        const result = await fileSystem.deleteFile(authorizedPath);
        publicationLeases.completePathChange(sourcePath);
        return result;
      } finally {
        finishChange();
      }
    }, "FILE_DELETE_FAILED")
  );

  // 重命名文件（校验源路径和目标路径都在工作区内）
  handleAppIpc(
    "file:rename",
    wrapIpcHandlerWithEvent(async (event, oldPath: string, newPath: string) => {
      assertNotWorkspaceRoot(event, oldPath, "file:rename (source)");
      assertNotWorkspaceRoot(event, newPath, "file:rename (dest)");
      oldPath = getWorkspaceEntryPath(event, oldPath, "file:rename (source)");
      newPath = getWorkspaceEntryPath(event, newPath, "file:rename (dest)");
      assertRegularFilePath(oldPath, "file:rename (source)");
      const sourcePath = fs.realpathSync.native(oldPath);
      const finishChange = publicationLeases.beginPathChange(sourcePath);
      try {
        const result = await fileSystem.renameFile(oldPath, newPath);
        const destinationPath = fs.realpathSync.native(newPath);
        publicationLeases.completePathChange(sourcePath, destinationPath);
        return result;
      } finally {
        finishChange();
      }
    }, "FILE_RENAME_FAILED")
  );

  // 复制文件（校验源路径和目标路径都在工作区内）
  handleAppIpc(
    "file:copy",
    wrapIpcHandlerWithEvent(async (event, sourcePath: string, destPath: string) => {
      sourcePath = getWorkspaceEntryPath(event, sourcePath, "file:copy (source)");
      destPath = getWorkspaceEntryPath(event, destPath, "file:copy (dest)");
      assertRegularFilePath(sourcePath, "file:copy (source)");
      return await fileSystem.copyFile(sourcePath, destPath);
    }, "FILE_COPY_FAILED")
  );

  // 检查文件是否存在（校验路径在工作区内）
  handleAppIpc(
    "file:exists",
    wrapIpcHandlerWithEvent(async (event, filePath: string) => {
      const authorizedPath = assertPathInWorkspace(event, filePath, "file:exists");
      return await fileSystem.exists(authorizedPath);
    }, "FILE_EXISTS_FAILED")
  );

  // 创建文件夹（校验路径在工作区内）
  handleAppIpc(
    "folder:create",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const authorizedPath = assertWorkspaceFolderPath(event, folderPath, "folder:create", true);
      return await fileSystem.createFolder(authorizedPath);
    }, "FOLDER_CREATE_FAILED")
  );

  // 删除文件夹（校验路径在工作区内）
  handleAppIpc(
    "folder:delete",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const authorizedPath = assertWorkspaceFolderPath(event, folderPath, "folder:delete");
      const sourcePath = fs.realpathSync.native(authorizedPath);
      const finishChange = publicationLeases.beginPathChange(sourcePath, true);
      try {
        const result = await fileSystem.deleteFolder(authorizedPath);
        publicationLeases.completePathChange(sourcePath, undefined, true);
        return result;
      } finally {
        finishChange();
      }
    }, "FOLDER_DELETE_FAILED")
  );

  // 重命名文件夹（校验源路径和目标路径都在工作区内）
  handleAppIpc(
    "folder:rename",
    wrapIpcHandlerWithEvent(async (event, oldPath: string, newPath: string) => {
      oldPath = assertWorkspaceFolderPath(event, oldPath, "folder:rename (source)");
      newPath = assertWorkspaceFolderPath(event, newPath, "folder:rename (dest)", true);
      const sourcePath = fs.realpathSync.native(oldPath);
      const finishChange = publicationLeases.beginPathChange(sourcePath, true);
      try {
        const result = await fileSystem.renameFolder(oldPath, newPath);
        const destinationPath = fs.realpathSync.native(newPath);
        publicationLeases.completePathChange(sourcePath, destinationPath, true);
        return result;
      } finally {
        finishChange();
      }
    }, "FOLDER_RENAME_FAILED")
  );

  // 在文件管理器中显示文件
  handleAppIpc("shell:showItemInFolder", (event, fullPath: string): IpcResultDTO<void> => {
    try {
      const authorizedPath = assertPathInWorkspace(event, fullPath, "shell:showItemInFolder");
      shell.showItemInFolder(authorizedPath);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "SHELL_SHOW_ITEM_FAILED");
    }
  });

  // 在文件管理器中打开文件夹
  handleAppIpc(
    "shell:openPath",
    wrapIpcHandlerWithEvent(async (event, fullPath: string) => {
      const authorizedPath = assertPathInWorkspace(event, fullPath, "shell:openPath");
      const errorMessage = await shell.openPath(authorizedPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
    }, "SHELL_OPEN_PATH_FAILED")
  );

  handleAppIpc(
    "shell:openNoteLink",
    wrapIpcHandlerWithEvent(async (event, fullPath: string) => {
      const validation = validatePathInWorkspace(getCallerWorkspaceScope(event), fullPath);
      const filePath = validation.isValid ? validation.normalizedPath : resolveLocalRegularFile(fullPath);
      if (!filePath || (!validation.isValid && !isExternalNoteFile(filePath))) {
        throw new Error("Unsupported local file link");
      }
      const error = await shell.openPath(filePath);
      if (error) throw new Error(error);
    }, "SHELL_OPEN_PATH_FAILED")
  );

  // 在系统默认浏览器中打开链接
  handleAppIpc(
    "shell:openExternal",
    wrapIpcHandler(async (url: string) => {
      if (!isSafeUrl(url)) {
        const protocol = getRejectedProtocol(url);
        throw new Error(`Unsafe URL protocol: ${protocol}`);
      }
      await shell.openExternal(url);
    }, "SHELL_OPEN_EXTERNAL_FAILED")
  );

  // 获取工作区的置顶笔记
  handleAppIpc("config:getPinnedNotes", async (event, _workspacePath: string): Promise<IpcResultDTO<string[]>> => {
    try {
      const pinnedNotes = await configManager.getPinnedNotes(getCallerWorkspace(event));
      return ipcOk(pinnedNotes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_PINNED_FAILED");
    }
  });

  // 设置工作区的置顶笔记
  handleAppIpc("config:setPinnedNotes", (event, _workspacePath: string, noteIds: string[]): IpcResultDTO<void> => {
    try {
      configManager.setPinnedNotes(getCallerWorkspace(event), noteIds);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_PINNED_FAILED");
    }
  });

  // 获取导出主题预设 ID
  handleAppIpc("config:getExportThemeId", (): IpcResultDTO<string> => {
    try {
      return ipcOk(configManager.getExportThemeId());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_EXPORT_THEME_FAILED");
    }
  });

  // 设置导出主题预设 ID
  // themeId 格式约定：仅允许小写字母、数字和连字符（如 "tech-blue"），与主题文件命名一致
  handleAppIpc("config:setExportThemeId", (_, themeId: string): IpcResultDTO<void> => {
    try {
      if (typeof themeId !== "string" || themeId.length === 0 || themeId.length > 64 || !/^[a-z0-9-]+$/.test(themeId)) {
        return ipcErr("Invalid themeId", "CONFIG_SET_EXPORT_THEME_INVALID");
      }
      configManager.setExportThemeId(themeId);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_EXPORT_THEME_FAILED");
    }
  });

  // 获取导出布局配置
  handleAppIpc("config:getExportLayout", (): IpcResultDTO<ExportLayoutConfig> => {
    try {
      return ipcOk(configManager.getExportLayout());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_EXPORT_LAYOUT_FAILED");
    }
  });

  // 设置导出布局配置（允许部分字段更新）
  handleAppIpc("config:setExportLayout", (_, patch: Partial<ExportLayoutConfig>): IpcResultDTO<void> => {
    try {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return ipcErr("Invalid export layout patch", "CONFIG_SET_EXPORT_LAYOUT_INVALID");
      }
      const normalized = normalizeExportLayoutConfig(patch);
      const sanitizedPatch: Partial<ExportLayoutConfig> = {};
      if ("outerBackground" in patch) sanitizedPatch.outerBackground = normalized.outerBackground;
      if ("innerBackground" in patch) sanitizedPatch.innerBackground = normalized.innerBackground;
      if ("contentWidth" in patch) sanitizedPatch.contentWidth = normalized.contentWidth;
      if ("cardPadding" in patch) sanitizedPatch.cardPadding = normalized.cardPadding;
      if ("baseFontSize" in patch) sanitizedPatch.baseFontSize = normalized.baseFontSize;
      configManager.setExportLayout(sanitizedPatch);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_EXPORT_LAYOUT_FAILED");
    }
  });

  // 获取快捷键配置
  handleAppIpc("config:getShortcuts", (): IpcResultDTO<ShortcutConfig> => {
    try {
      return ipcOk(configManager.getShortcuts());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_SHORTCUTS_FAILED");
    }
  });

  handleAppIpc("config:setShortcut", (_, id: ShortcutId, binding: ShortcutBinding): IpcResultDTO<ShortcutConfig> => {
    try {
      if (
        typeof id !== "string" ||
        !Object.hasOwn(DEFAULT_SHORTCUTS, id) ||
        !binding ||
        typeof binding.code !== "string" ||
        !binding.code ||
        ![binding.ctrl, binding.shift, binding.alt, binding.meta].every((value) => typeof value === "boolean")
      ) {
        throw new Error("Invalid shortcut binding");
      }
      const normalized = { ...configManager.getShortcuts(), [id]: binding };
      const shortcutPlatform = process.platform === "darwin" ? "mac" : "default";
      const menuShortcutPlatform = process.platform === "darwin" ? "mac" : "win";
      const conflicts = findShortcutConflicts(normalized, shortcutPlatform);
      if (conflicts.length > 0) {
        const ids = conflicts[0].ids.join(", ");
        return ipcErr(`Shortcut conflict detected: ${ids}`, "CONFIG_SET_SHORTCUTS_CONFLICT");
      }

      const reservedMenuShortcuts = getReservedMenuShortcuts(menuShortcutPlatform);
      for (const [id, binding] of Object.entries(normalized) as [
        keyof ShortcutConfig,
        ShortcutConfig[keyof ShortcutConfig]
      ][]) {
        const key = getShortcutBindingKey(binding, id, shortcutPlatform);
        const reservedConflict = reservedMenuShortcuts.find((item) => item.key === key);
        if (reservedConflict) {
          return ipcErr(
            `Shortcut conflicts with menu action: ${reservedConflict.action}`,
            "CONFIG_SET_SHORTCUTS_RESERVED_CONFLICT"
          );
        }
      }

      configManager.setShortcuts(normalized);
      for (const { window } of windowManager.getAllEntries()) {
        if (!window.isDestroyed()) window.webContents.send("config:shortcutsChanged", normalized);
      }
      return ipcOk(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_SHORTCUTS_FAILED");
    }
  });

  // 获取全部 GitHub 项目配置
  handleAppIpc(
    "config:getGitHubProjectConfigs",
    (): IpcResultDTO<{ projectConfigs: GitHubProjectConfigMap; activeProjectKey: string }> => {
      try {
        return ipcOk({
          projectConfigs: configManager.getPublicGitHubProjectConfigs(),
          activeProjectKey: configManager.getGitHubActiveProjectKey()
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ipcErr(message, "CONFIG_GET_GITHUB_PROJECTS_FAILED");
      }
    }
  );

  // 获取 GitHub 配置
  handleAppIpc("config:getGitHubConfig", (_, projectKey?: string): IpcResultDTO<GitHubConfig> => {
    try {
      return ipcOk({ ...configManager.getGitHubConfig(projectKey), token: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_GET_GITHUB_FAILED");
    }
  });

  // 设置 GitHub 配置
  handleAppIpc("config:setGitHubConfig", (_, config: GitHubConfig, projectKey?: string): IpcResultDTO<void> => {
    try {
      if (!config || typeof config !== "object") {
        return ipcErr("Invalid GitHub config", "CONFIG_SET_GITHUB_INVALID");
      }
      configManager.setGitHubConfig(config, projectKey);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_GITHUB_FAILED");
    }
  });

  // 设置 GitHub 当前选中的项目键
  handleAppIpc("config:setGitHubActiveProjectKey", (_, projectKey: string): IpcResultDTO<void> => {
    try {
      configManager.setGitHubActiveProjectKey(projectKey);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_SET_GITHUB_ACTIVE_FAILED");
    }
  });

  // 删除指定 GitHub 项目配置
  handleAppIpc("config:removeGitHubProjectConfig", (_, projectKey: string): IpcResultDTO<void> => {
    try {
      const normalizedKey = String(projectKey || "").trim();
      if (!normalizedKey) {
        return ipcErr("Invalid GitHub project key", "CONFIG_REMOVE_GITHUB_PROJECT_INVALID");
      }
      configManager.removeGitHubProjectConfig(normalizedKey);
      return ipcOk(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ipcErr(message, "CONFIG_REMOVE_GITHUB_PROJECT_FAILED");
    }
  });
}
