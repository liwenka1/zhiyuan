import { ipcMain } from "electron";
import { importRss } from "../rss";

export function registerRssHandlers(): void {
  ipcMain.handle("rss:import", async (_, url: string, workspacePath: string) => {
    return await importRss(url, workspacePath);
  });
}
