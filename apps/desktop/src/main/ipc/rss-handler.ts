import { ipcMain } from "electron";
import { importRss, updateRss, unsubscribeRss } from "../rss";
import { wrapIpcHandlerWithEvent } from "./ipc-result";
import { getCallerWorkspace } from "../security/window-context";
import { validatePathInWorkspace } from "../security/path-validator";
import path from "path";

export function registerRssHandlers(): void {
  ipcMain.handle(
    "rss:import",
    wrapIpcHandlerWithEvent(async (event, url: string, _workspacePath: string) => {
      return await importRss(url, getCallerWorkspace(event));
    }, "RSS_IMPORT_FAILED")
  );

  ipcMain.handle(
    "rss:update",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const workspacePath = getCallerWorkspace(event);
      if (!validatePathInWorkspace(workspacePath, folderPath).isValid) {
        throw new Error("RSS folder is outside workspace");
      }
      return await updateRss(path.resolve(folderPath));
    }, "RSS_UPDATE_FAILED")
  );

  ipcMain.handle(
    "rss:unsubscribe",
    wrapIpcHandlerWithEvent(async (event, folderPath: string) => {
      const workspacePath = getCallerWorkspace(event);
      if (!validatePathInWorkspace(workspacePath, folderPath).isValid) {
        throw new Error("RSS folder is outside workspace");
      }
      await unsubscribeRss(path.resolve(folderPath));
    }, "RSS_UNSUBSCRIBE_FAILED")
  );
}
