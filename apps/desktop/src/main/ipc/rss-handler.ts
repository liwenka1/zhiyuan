import { ipcMain } from "electron";
import { importRss, updateRss } from "../rss";

export function registerRssHandlers(): void {
  ipcMain.handle("rss:import", async (_, url: string, workspacePath: string) => {
    return await importRss(url, workspacePath);
  });

  ipcMain.handle("rss:update", async (_, folderPath: string) => {
    return await updateRss(folderPath);
  });
}
