import { ipcRenderer } from "electron";

export const diagnosticsApi = {
  reportError: (payload: { source: string; message: string; stack?: string }): void => {
    ipcRenderer.send("diagnostics:renderer-error", payload);
  }
};
