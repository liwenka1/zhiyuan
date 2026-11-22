import { ipcRenderer } from "electron";
import type { IpcResultDTO } from "@shared";

export const terminalApi = {
  create: (id: string): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("terminal:create", id),

  write: (id: string, data: string): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("terminal:input", id, data),

  resize: (id: string, cols: number, rows: number): Promise<IpcResultDTO<void>> =>
    ipcRenderer.invoke("terminal:resize", id, cols, rows),

  dispose: (id: string): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("terminal:dispose", id),

  onData: (callback: (payload: { id: string; data: string }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => callback(payload);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },

  onExit: (callback: (payload: { id: string; exitCode: number; signal?: number }) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; exitCode: number; signal?: number }) =>
      callback(payload);
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  }
};
