import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const watcherApi = {
  pause: (): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("watcher:pause"),
  resume: (): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("watcher:resume")
};
