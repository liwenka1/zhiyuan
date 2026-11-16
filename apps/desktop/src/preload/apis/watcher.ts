import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const watcherApi = {
  pause: (expectedWorkspacePath?: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("watcher:pause", expectedWorkspacePath),
  resume: (expectedWorkspacePath?: string): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("watcher:resume", expectedWorkspacePath)
};
