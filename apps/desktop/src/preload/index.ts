import { contextBridge } from "electron";
import { observeNativeMarkdownDrops } from "./apis/workspace";
import { observeNativeClipboardCopies } from "./apis/export";
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
  terminalApi,
  diagnosticsApi
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
  terminal: terminalApi,
  diagnostics: diagnosticsApi
};

if (process.isMainFrame && process.contextIsolated) {
  observeNativeMarkdownDrops(window);
  observeNativeClipboardCopies(window);
  contextBridge.exposeInMainWorld("api", api);
}
