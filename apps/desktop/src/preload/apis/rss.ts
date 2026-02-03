import { ipcRenderer } from "electron";

export const rssApi = {
  import: (
    url: string,
    workspacePath: string
  ): Promise<{
    folderName: string;
    folderPath: string;
    itemCount: number;
  }> => ipcRenderer.invoke("rss:import", url, workspacePath),

  update: (folderPath: string): Promise<{ addedCount: number }> => ipcRenderer.invoke("rss:update", folderPath),

  unsubscribe: (folderPath: string): Promise<{ success: boolean }> => ipcRenderer.invoke("rss:unsubscribe", folderPath)
};
