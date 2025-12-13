import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import type { Theme } from "@shared";

// Custom APIs for renderer
const api = {
  theme: {
    /**
     * 获取当前主题
     */
    get: (): Promise<Theme> => ipcRenderer.invoke("theme:get"),

    /**
     * 设置主题
     */
    set: (theme: Theme): Promise<void> => ipcRenderer.invoke("theme:set", theme),

    /**
     * 监听主题变化（系统主题或用户设置变化）
     */
    onChanged: (callback: (theme: Theme) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, theme: Theme) => {
        callback(theme);
      };
      ipcRenderer.on("theme:changed", listener);

      // 返回取消监听函数
      return () => {
        ipcRenderer.removeListener("theme:changed", listener);
      };
    }
  }
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
