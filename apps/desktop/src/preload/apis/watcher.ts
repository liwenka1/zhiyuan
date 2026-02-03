import { ipcRenderer } from "electron";

export const watcherApi = {
  pause: (): Promise<void> => ipcRenderer.invoke("watcher:pause"),
  resume: (): Promise<void> => ipcRenderer.invoke("watcher:resume")
};
