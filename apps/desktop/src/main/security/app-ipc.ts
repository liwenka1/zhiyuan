import { ipcMain } from "electron";
import type { IpcResultDTO } from "@shared";
import { ipcErr } from "../ipc/ipc-result";
import { windowManager } from "../window-manager";

function isTrustedSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  if (event.sender.isDestroyed()) return false;
  const entry = windowManager.getEntryByWebContents(event.sender);
  const frame = event.senderFrame;
  if (!entry || !frame || frame !== event.sender.mainFrame) {
    return false;
  }

  // Same-document anchors do not change the identity of the renderer document.
  return frame.url.split("#", 1)[0] === entry.rendererUrl;
}

export function handleAppIpc<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    ...args: TArgs
  ) => IpcResultDTO<TResult> | Promise<IpcResultDTO<TResult>>
): void {
  ipcMain.handle(channel, (event, ...args: TArgs) => {
    if (!isTrustedSender(event)) return ipcErr("Untrusted IPC sender", "IPC_SENDER_UNAUTHORIZED");
    return handler(event, ...args);
  });
}

export function onAppIpc<TArgs extends unknown[]>(
  channel: string,
  listener: (event: Electron.IpcMainEvent, ...args: TArgs) => void
): void {
  ipcMain.on(channel, (event, ...args: TArgs) => {
    if (isTrustedSender(event)) listener(event, ...args);
  });
}
