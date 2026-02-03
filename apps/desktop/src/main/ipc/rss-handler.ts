import { ipcMain } from "electron";
import { importRss, updateRss, unsubscribeRss } from "../rss";
import { wrapIpcHandler } from "./ipc-result";

export function registerRssHandlers(): void {
  ipcMain.handle(
    "rss:import",
    wrapIpcHandler(async (url: string, workspacePath: string) => {
      return await importRss(url, workspacePath);
    }, "RSS_IMPORT_FAILED")
  );

  ipcMain.handle(
    "rss:update",
    wrapIpcHandler(async (folderPath: string) => {
      return await updateRss(folderPath);
    }, "RSS_UPDATE_FAILED")
  );

  ipcMain.handle(
    "rss:unsubscribe",
    wrapIpcHandler(async (folderPath: string) => {
      await unsubscribeRss(folderPath);
    }, "RSS_UNSUBSCRIBE_FAILED")
  );
}
