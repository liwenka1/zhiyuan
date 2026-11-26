import { BrowserWindow, dialog } from "electron";
import { getCallerWorkspace } from "../security/window-context";
import type { WorkspacePathScope } from "../security/path-validator";
import { inspectExportAssets, type ExportAssets } from "./assets";
import { validateExportImages } from "./capture";
import type { ExportAssetTarget } from "./asset-markup";

export interface ExportResourceReview {
  assets: ExportAssets;
  includeExternal: boolean;
  missingLabel: string;
}

const messages = {
  zh: {
    title: "检查导出资源",
    external: "工作区外的资源",
    missing: "以下资源无法纳入导出",
    include: (count: number) => `包含这 ${count} 个工作区外的资源`,
    proceed: "继续导出",
    cancel: "取消",
    missingLabel: "未纳入导出",
    clipboard: {
      title: "检查复制资源",
      missing: "以下资源无法纳入复制",
      proceed: "继续复制",
      missingLabel: "未纳入复制",
      ready: "笔记已准备好复制",
      replace: "现在复制会替换系统剪贴板中的内容。",
      copyNow: "现在复制"
    },
    reasons: {
      local: "文件不存在或格式不支持",
      unreadable: "无法读取文件",
      http: "网络图片需要 HTTPS 地址",
      download: "网络图片加载失败",
      decode: "无法解码图片",
      size: "超出剪贴板资源大小限制"
    }
  },
  en: {
    title: "Review export resources",
    external: "Resources outside the workspace",
    missing: "Resources unavailable for export",
    include: (count: number) => `Include these resources outside the workspace (${count})`,
    proceed: "Continue Export",
    cancel: "Cancel",
    missingLabel: "Omitted from export",
    clipboard: {
      title: "Review clipboard resources",
      missing: "Resources unavailable for copying",
      proceed: "Continue Copying",
      missingLabel: "Omitted from copy",
      ready: "Note ready to copy",
      replace: "Copying now will replace the contents of the system clipboard.",
      copyNow: "Copy Now"
    },
    reasons: {
      local: "File missing or unsupported",
      unreadable: "File could not be read",
      http: "Remote images require HTTPS",
      download: "Image download failed",
      decode: "Image could not be decoded",
      size: "Exceeds the clipboard resource size limit"
    }
  }
};

export async function reviewExportResources(
  event: Electron.IpcMainInvokeEvent,
  documents: string[],
  notePath: string | undefined,
  workspace: WorkspacePathScope,
  target: ExportAssetTarget,
  language: keyof typeof messages,
  request?: { assertCurrent: () => Promise<void>; signal: AbortSignal }
): Promise<ExportResourceReview> {
  const assets = await inspectExportAssets(
    documents,
    notePath,
    workspace,
    target,
    target === "html" ? undefined : validateExportImages,
    request?.signal
  );
  await request?.assertCurrent();
  if (getCallerWorkspace(event) !== workspace.workspacePath) throw new Error("The export workspace changed");
  const { externalFiles, missing } = assets;
  const copy = messages[language];
  const message = target === "clipboard" ? copy.clipboard : copy;
  const review = { assets, includeExternal: false, missingLabel: message.missingLabel };
  if (!externalFiles.length && !missing.length) return review;

  const details: string[] = [];
  if (externalFiles.length) details.push([copy.external, ...externalFiles.map((file) => `• ${file}`)].join("\n"));
  if (missing.length) {
    details.push(
      [message.missing, ...missing.map(({ name, reason }) => `• ${name} (${copy.reasons[reason]})`)].join("\n")
    );
  }
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("Cannot resolve caller window");
  const choice = await dialog.showMessageBox(window, {
    type: "info",
    title: message.title,
    message: message.title,
    detail: details.join("\n\n"),
    buttons: [message.proceed, copy.cancel],
    signal: request?.signal,
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    ...(externalFiles.length ? { checkboxLabel: copy.include(externalFiles.length), checkboxChecked: false } : {})
  });
  await request?.assertCurrent();
  if (choice.response !== 0 || getCallerWorkspace(event) !== workspace.workspacePath) throw new Error("USER_CANCELLED");
  return { ...review, includeExternal: externalFiles.length > 0 && choice.checkboxChecked };
}

export async function confirmClipboardWrite(
  event: Electron.IpcMainInvokeEvent,
  language: keyof typeof messages,
  signal: AbortSignal
) {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("Cannot resolve caller window");
  const { clipboard, cancel } = messages[language];
  const { response } = await dialog.showMessageBox(window, {
    type: "info",
    title: clipboard.ready,
    message: clipboard.ready,
    detail: clipboard.replace,
    buttons: [clipboard.copyNow, cancel],
    signal,
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (response !== 0) throw new Error("USER_CANCELLED");
}
