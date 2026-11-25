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
    export: "继续导出",
    cancel: "取消",
    missingLabel: "未纳入导出",
    reasons: {
      local: "文件不存在或格式不支持",
      unreadable: "无法读取文件",
      http: "截图导出只支持 HTTPS 图片",
      download: "网络图片加载失败",
      decode: "无法解码图片"
    }
  },
  en: {
    title: "Review export resources",
    external: "Resources outside the workspace",
    missing: "Resources unavailable for export",
    include: (count: number) => `Include these resources outside the workspace (${count})`,
    export: "Continue Export",
    cancel: "Cancel",
    missingLabel: "Omitted from export",
    reasons: {
      local: "File missing or unsupported",
      unreadable: "File could not be read",
      http: "Image exports require HTTPS",
      download: "Image download failed",
      decode: "Image could not be decoded"
    }
  }
};

export async function reviewExportResources(
  event: Electron.IpcMainInvokeEvent,
  documents: string[],
  notePath: string | undefined,
  workspace: WorkspacePathScope,
  target: ExportAssetTarget,
  language: keyof typeof messages
): Promise<ExportResourceReview> {
  const assets = await inspectExportAssets(
    documents,
    notePath,
    workspace,
    target,
    target === "capture" ? validateExportImages : undefined
  );
  if (getCallerWorkspace(event) !== workspace.workspacePath) throw new Error("The export workspace changed");
  const { externalFiles, missing } = assets;
  const copy = messages[language];
  const review = { assets, includeExternal: false, missingLabel: copy.missingLabel };
  if (!externalFiles.length && !missing.length) return review;

  const details: string[] = [];
  if (externalFiles.length) details.push([copy.external, ...externalFiles.map((file) => `• ${file}`)].join("\n"));
  if (missing.length) {
    details.push(
      [copy.missing, ...missing.map(({ name, reason }) => `• ${name} (${copy.reasons[reason]})`)].join("\n")
    );
  }
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("Cannot resolve caller window");
  const choice = await dialog.showMessageBox(window, {
    type: "info",
    title: copy.title,
    message: copy.title,
    detail: details.join("\n\n"),
    buttons: [copy.export, copy.cancel],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    ...(externalFiles.length ? { checkboxLabel: copy.include(externalFiles.length), checkboxChecked: false } : {})
  });
  if (choice.response !== 0 || getCallerWorkspace(event) !== workspace.workspacePath) throw new Error("USER_CANCELLED");
  return { ...review, includeExternal: externalFiles.length > 0 && choice.checkboxChecked };
}
