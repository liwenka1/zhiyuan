import type { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { windowManager } from "./window-manager";
import { isIgnoredWorkspaceDirectory, MAX_WORKSPACE_DEPTH } from "./workspace/policy";

export type ExternalOpenPayload = { workspacePath: string; filePath?: string };

function getCurrentScanRoot(workspacePath: string, scannedRoot: string | null): string {
  if (scannedRoot && scannedRoot !== workspacePath) {
    try {
      if (fs.realpathSync.native(scannedRoot) === workspacePath) return scannedRoot;
    } catch {
      // The scanned alias may have disappeared while the canonical workspace is still available.
    }
  }
  return workspacePath;
}

export function findOpenTargetWindow(payload: ExternalOpenPayload): {
  window: BrowserWindow;
  payload: ExternalOpenPayload;
} | null {
  let workspacePath = payload.workspacePath;
  // An ancestor can host the file only if the workspace scanner visits that directory.
  for (let depth = 0; depth <= MAX_WORKSPACE_DEPTH; depth += 1) {
    const entry = windowManager.findWorkspaceEntry(workspacePath);
    if (entry) {
      const scannedRoot = getCurrentScanRoot(workspacePath, entry.scannedWorkspacePath);
      return {
        window: entry.window,
        payload: payload.filePath
          ? {
              workspacePath: scannedRoot,
              filePath: path.join(scannedRoot, path.relative(workspacePath, payload.filePath))
            }
          : { workspacePath: scannedRoot }
      };
    }
    const parent = path.dirname(workspacePath);
    if (!payload.filePath || parent === workspacePath || isIgnoredWorkspaceDirectory(path.basename(workspacePath))) {
      break;
    }
    workspacePath = parent;
  }
  return null;
}

export function sendExternalOpen(win: BrowserWindow, payload: ExternalOpenPayload): void {
  if (win.webContents.isLoadingMainFrame()) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("workspace:external-open", payload);
    });
  } else {
    win.webContents.send("workspace:external-open", payload);
  }
}

export function focusAndSendExternalOpen(win: BrowserWindow, payload: ExternalOpenPayload): void {
  if (win.isMinimized()) win.restore();
  win.focus();
  sendExternalOpen(win, payload);
}
