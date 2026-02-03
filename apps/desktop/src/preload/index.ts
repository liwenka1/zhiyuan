import { contextBridge, ipcRenderer } from "electron";
import {
  themeApi,
  workspaceApi,
  fileApi,
  watcherApi,
  folderApi,
  shellApi,
  windowApi,
  exportApi,
  utilsApi,
  configApi,
  rssApi,
  urlApi
} from "./apis";

// 手动创建 electronAPI（替代 @electron-toolkit/preload，因为它在沙盒模式下无法加载）
// 提供对 ipcRenderer 和 process 的安全访问
const electronAPI = {
  ipcRenderer: {
    send(channel: string, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: string, func: (...args: unknown[]) => void) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke(channel: string, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  process: {
    platform: process.platform,
    versions: process.versions,
    env: process.env
  }
};

// 聚合所有 API 模块
const api = {
  theme: themeApi,
  workspace: workspaceApi,
  file: fileApi,
  watcher: watcherApi,
  folder: folderApi,
  shell: shellApi,
  window: windowApi,
  export: exportApi,
  utils: utilsApi,
  config: configApi,
  rss: rssApi,
  url: urlApi
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
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
}
