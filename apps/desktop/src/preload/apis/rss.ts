import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const rssApi = {
  import: (
    url: string,
    workspacePath: string
  ): Promise<
    IpcResultDTO<{
      folderName: string;
      folderPath: string;
      itemCount: number;
    }>
  > => ipcRenderer.invoke("rss:import", url, workspacePath),

  update: (folderPath: string): Promise<IpcResultDTO<{ addedCount: number }>> =>
    ipcRenderer.invoke("rss:update", folderPath),

  unsubscribe: (folderPath: string): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("rss:unsubscribe", folderPath)
};
