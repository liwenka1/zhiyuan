import { contextBridge } from "electron";
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
  githubApi,
  rssApi,
  urlApi,
  terminalApi
} from "./apis";

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
  github: githubApi,
  rss: rssApi,
  url: urlApi,
  terminal: terminalApi
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("api", api);
} else {
  Object.assign(window, { api });
}
