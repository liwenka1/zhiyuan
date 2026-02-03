import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { Theme, ThemeMode, IpcResultDTO } from "@shared";

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

// Custom APIs for renderer
const api = {
  theme: {
    /**
     * 获取当前主题
     */
    get: (): Promise<IpcResultDTO<Theme>> => ipcRenderer.invoke("theme:get"),

    /**
     * 设置主题
     */
    set: (theme: ThemeMode): Promise<IpcResultDTO<void>> => ipcRenderer.invoke("theme:set", theme),

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
    select: (options?: { title?: string; buttonLabel?: string }): Promise<string | null> =>
      ipcRenderer.invoke("workspace:select", options),

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

  watcher: {
    pause: (): Promise<void> => ipcRenderer.invoke("watcher:pause"),
    resume: (): Promise<void> => ipcRenderer.invoke("watcher:resume")
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
    openPath: (fullPath: string): Promise<string> => ipcRenderer.invoke("shell:openPath", fullPath),

    /**
     * 在系统默认浏览器中打开链接
     */
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke("shell:openExternal", url)
  },

  window: {
    /**
     * 设置窗口全屏状态
     */
    setFullScreen: (fullScreen: boolean): Promise<void> => ipcRenderer.invoke("window:setFullScreen", fullScreen),

    /**
     * 获取窗口全屏状态
     */
    isFullScreen: (): Promise<boolean> => ipcRenderer.invoke("window:isFullScreen")
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
     * @param notePath 可选，笔记的完整文件路径，用于将相对路径的图片转换为 Base64
     */
    exportAsPDF: (htmlContent: string, filePath: string, notePath?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("export:export-as-pdf", htmlContent, filePath, notePath),

    /**
     * 导出为图片（单张长图）
     * @param notePath 可选，笔记的完整文件路径，用于将相对路径的图片转换为 Base64
     * @param options 可选配置，width 为图片宽度，默认 800
     */
    exportAsImage: (
      htmlContent: string,
      filePath: string,
      notePath?: string,
      options?: { width?: number }
    ): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("export:export-as-image", htmlContent, filePath, notePath, options),

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
      ipcRenderer.invoke("export:copy-html-to-clipboard", htmlContent),

    /**
     * 导出 HTML 资源包（包含所有图片等资源）
     */
    exportHTMLPackage: (
      htmlContent: string,
      outputPath: string,
      notePath: string | undefined,
      assetsFolder?: string
    ): Promise<{
      filesCount: number;
      copiedFiles: string[];
    }> => ipcRenderer.invoke("export:export-html-package", htmlContent, outputPath, notePath, assetsFolder),

    /**
     * 导出为 PDF（分页）
     */
    exportAsPDFPages: (
      htmlContents: string[],
      filePath: string,
      notePath?: string
    ): Promise<{
      pagesCount: number;
    }> => ipcRenderer.invoke("export:export-as-pdf-pages", htmlContents, filePath, notePath),

    /**
     * 导出为图片（分页）
     */
    exportAsImagePages: (
      htmlContents: string[],
      folderPath: string,
      baseFileName: string,
      notePath?: string,
      options?: { width?: number }
    ): Promise<{
      filesCount: number;
      filePaths: string[];
    }> => ipcRenderer.invoke("export:export-as-image-pages", htmlContents, folderPath, baseFileName, notePath, options),

    /**
     * 获取字体文件的 base64 编码（用于 PDF/图片导出时内嵌字体）
     */
    getFontsBase64: (): Promise<{
      lxgwBase64: string;
      jetBrainsBase64: string;
    }> => ipcRenderer.invoke("export:get-fonts-base64")
  },

  utils: {
    /**
     * 获取拖拽文件的本地路径
     * 用于处理文件拖拽到编辑器的场景
     */
    getPathForFile: (file: File): string => webUtils.getPathForFile(file)
  },

  config: {
    /**
     * 获取工作区的置顶笔记列表
     */
    getPinnedNotes: (workspacePath: string): Promise<string[]> =>
      ipcRenderer.invoke("config:getPinnedNotes", workspacePath),

    /**
     * 设置工作区的置顶笔记列表
     */
    setPinnedNotes: (workspacePath: string, noteIds: string[]): Promise<void> =>
      ipcRenderer.invoke("config:setPinnedNotes", workspacePath, noteIds)
  },

  rss: {
    import: (
      url: string,
      workspacePath: string
    ): Promise<{
      folderName: string;
      folderPath: string;
      itemCount: number;
    }> => ipcRenderer.invoke("rss:import", url, workspacePath),
    update: (folderPath: string): Promise<{ addedCount: number }> => ipcRenderer.invoke("rss:update", folderPath),
    unsubscribe: (folderPath: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("rss:unsubscribe", folderPath)
  },

  url: {
    /**
     * 从 URL 创建笔记
     */
    createNote: (
      url: string,
      workspacePath: string,
      folderId?: string
    ): Promise<{
      noteId: string;
      filePath: string;
      title: string;
    }> => ipcRenderer.invoke("url:createNote", url, workspacePath, folderId)
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
  // @ts-expect-error (define in dts)
  window.electron = electronAPI;
  // @ts-expect-error (define in dts)
  window.api = api;
}
