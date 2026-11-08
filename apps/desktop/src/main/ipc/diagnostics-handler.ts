import { BrowserWindow, ipcMain } from "electron";
import { recordDiagnostic } from "../diagnostics";

type RendererErrorPayload = {
  source?: unknown;
  message?: unknown;
  stack?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function registerDiagnosticsHandlers(): void {
  ipcMain.on("diagnostics:renderer-error", (event, payload: unknown) => {
    if (!isRecord(payload)) return;

    const data = payload as RendererErrorPayload;
    const message = typeof data.message === "string" ? data.message : "Unknown renderer error";
    const error = new Error(message);
    if (typeof data.stack === "string") error.stack = data.stack;

    const win = BrowserWindow.fromWebContents(event.sender);
    recordDiagnostic("renderer.error", error, {
      source: typeof data.source === "string" ? data.source : "unknown",
      windowId: win?.id ?? null
    });
  });
}
