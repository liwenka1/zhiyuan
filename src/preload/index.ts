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
  },

  workspace: {
    /**
     * 选择工作区文件夹
     */
    select: (): Promise<string | null> => ipcRenderer.invoke("workspace:select"),

    /**
     * 获取当前工作区路径
     */
    getCurrent: (): Promise<string | null> => ipcRenderer.invoke("workspace:getCurrent"),

    /**
     * 扫描工作区
     */
    scan: (
      workspacePath: string
    ): Promise<{
      folders: Array<{ id: string; name: string; path: string; noteCount: number }>;
      notes: Array<{
        id: string;
        title: string;
        content: string;
        fileName: string;
        filePath: string;
        folderId: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }> => ipcRenderer.invoke("workspace:scan", workspacePath),

    /**
     * 获取最近打开的工作区
     */
    getRecent: (): Promise<string[]> => ipcRenderer.invoke("workspace:getRecent"),

    /**
     * 创建默认工作区
     */
    createDefault: (): Promise<string> => ipcRenderer.invoke("workspace:createDefault"),

    /**
     * 检查默认工作区是否存在
     */
    checkDefaultExists: (): Promise<boolean> => ipcRenderer.invoke("workspace:checkDefaultExists")
  },

  file: {
    /**
     * 读取文件
     */
    read: (filePath: string): Promise<{ content: string; mtime: number }> => ipcRenderer.invoke("file:read", filePath),

    /**
     * 写入文件
     */
    write: (filePath: string, content: string): Promise<{ mtime: number }> =>
      ipcRenderer.invoke("file:write", filePath, content),

    /**
     * 创建文件
     */
    create: (filePath: string, content: string): Promise<void> => ipcRenderer.invoke("file:create", filePath, content),

    /**
     * 删除文件
     */
    delete: (filePath: string): Promise<void> => ipcRenderer.invoke("file:delete", filePath),

    /**
     * 重命名文件
     */
    rename: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke("file:rename", oldPath, newPath),

    /**
     * 复制文件
     */
    copy: (sourcePath: string, destPath: string): Promise<void> =>
      ipcRenderer.invoke("file:copy", sourcePath, destPath),

    /**
     * 监听文件变化
     */
    onChanged: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
        callback(data);
      };
      ipcRenderer.on("file:changed", listener);
      return () => {
        ipcRenderer.removeListener("file:changed", listener);
      };
    },

    /**
     * 监听文件添加
     */
    onAdded: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
        callback(data);
      };
      ipcRenderer.on("file:added", listener);
      return () => {
        ipcRenderer.removeListener("file:added", listener);
      };
    },

    /**
     * 监听文件删除
     */
    onDeleted: (callback: (data: { filePath: string; fullPath: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { filePath: string; fullPath: string }) => {
        callback(data);
      };
      ipcRenderer.on("file:deleted", listener);
      return () => {
        ipcRenderer.removeListener("file:deleted", listener);
      };
    }
  },

  folder: {
    /**
     * 创建文件夹
     */
    create: (folderPath: string): Promise<void> => ipcRenderer.invoke("folder:create", folderPath),

    /**
     * 删除文件夹
     */
    delete: (folderPath: string): Promise<void> => ipcRenderer.invoke("folder:delete", folderPath),

    /**
     * 重命名文件夹
     */
    rename: (oldPath: string, newPath: string): Promise<void> => ipcRenderer.invoke("folder:rename", oldPath, newPath),

    /**
     * 监听文件夹添加
     */
    onAdded: (callback: (data: { folderPath: string; fullPath: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { folderPath: string; fullPath: string }) => {
        callback(data);
      };
      ipcRenderer.on("folder:added", listener);
      return () => {
        ipcRenderer.removeListener("folder:added", listener);
      };
    },

    /**
     * 监听文件夹删除
     */
    onDeleted: (callback: (data: { folderPath: string; fullPath: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: { folderPath: string; fullPath: string }) => {
        callback(data);
      };
      ipcRenderer.on("folder:deleted", listener);
      return () => {
        ipcRenderer.removeListener("folder:deleted", listener);
      };
    }
  },

  shell: {
    /**
     * 在文件管理器中显示文件
     */
    showItemInFolder: (fullPath: string): Promise<void> => ipcRenderer.invoke("shell:showItemInFolder", fullPath),

    /**
     * 在文件管理器中打开文件夹
     */
    openPath: (fullPath: string): Promise<string> => ipcRenderer.invoke("shell:openPath", fullPath)
  },

  export: {
    /**
     * 将 Markdown 转换为 HTML
     * @param markdown Markdown 内容
     * @param notePath 可选，笔记的完整文件路径，用于将相对路径转换为绝对路径
     */
    markdownToHTML: (markdown: string, notePath?: string): Promise<string> =>
      ipcRenderer.invoke("export:markdown-to-html", markdown, notePath),

    /**
     * 显示保存对话框
     */
    showSaveDialog: (options: {
      title: string;
      defaultPath: string;
      filters: Array<{ name: string; extensions: string[] }>;
    }): Promise<string | null> => ipcRenderer.invoke("export:show-save-dialog", options),

    /**
     * 保存 HTML 文件
     */
    saveHTMLFile: (filePath: string, htmlContent: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("export:save-html-file", filePath, htmlContent),

    /**
     * 导出为 PDF
     */
    exportAsPDF: (htmlContent: string, filePath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("export:export-as-pdf", htmlContent, filePath),

    /**
     * 获取用户下载目录
     */
    getDownloadsPath: (): Promise<string> => ipcRenderer.invoke("export:get-downloads-path"),

    /**
     * 将 HTML 中的 CSS 内联化（用于微信公众号）
     */
    inlineCSS: (htmlContent: string): Promise<string> => ipcRenderer.invoke("export:inline-css", htmlContent),

    /**
     * 复制 HTML 到剪贴板（用于微信公众号）
     */
    copyHTMLToClipboard: (htmlContent: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("export:copy-html-to-clipboard", htmlContent)
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
