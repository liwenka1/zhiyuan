import { ElectronAPI } from "@electron-toolkit/preload";
import type { Theme } from "@shared";

// 主题 API 接口
export interface ThemeAPI {
  /**
   * 获取当前主题
   */
  get: () => Promise<Theme>;

  /**
   * 设置主题
   */
  set: (theme: Theme) => Promise<void>;

  /**
   * 监听主题变化（系统主题或用户设置变化）
   * @returns 取消监听函数
   */
  onChanged: (callback: (theme: Theme) => void) => () => void;
}

// 工作区 API 接口
export interface WorkspaceAPI {
  select: (options?: { title?: string; buttonLabel?: string }) => Promise<string | null>;
  getCurrent: () => Promise<string | null>;
  scan: (workspacePath: string) => Promise<{
    folders: Array<{ id: string; name: string; path: string; noteCount: number; isRss?: boolean }>;
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
  }>;
  getRecent: () => Promise<string[]>;
  createDefault: () => Promise<string>;
  checkDefaultExists: () => Promise<boolean>;
}

// 文件 API 接口
export interface FileAPI {
  read: (filePath: string) => Promise<{ content: string; mtime: number }>;
  write: (filePath: string, content: string) => Promise<{ mtime: number }>;
  create: (filePath: string, content: string) => Promise<void>;
  delete: (filePath: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  copy: (sourcePath: string, destPath: string) => Promise<void>;
  onChanged: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
  onAdded: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
  onDeleted: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
}

// 文件夹 API 接口
export interface FolderAPI {
  create: (folderPath: string) => Promise<void>;
  delete: (folderPath: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  onAdded: (callback: (data: { folderPath: string; fullPath: string }) => void) => () => void;
  onDeleted: (callback: (data: { folderPath: string; fullPath: string }) => void) => () => void;
}

// Shell API 接口
export interface ShellAPI {
  showItemInFolder: (fullPath: string) => Promise<void>;
  openPath: (fullPath: string) => Promise<string>;
  openExternal: (url: string) => Promise<void>;
}

// 窗口 API 接口
export interface WindowAPI {
  /**
   * 设置窗口全屏状态
   */
  setFullScreen: (fullScreen: boolean) => Promise<void>;

  /**
   * 获取窗口全屏状态
   */
  isFullScreen: () => Promise<boolean>;
}

// 导出 API 接口
export interface ExportAPI {
  /**
   * 将 Markdown 转换为 HTML
   * @param markdown Markdown 内容
   * @param notePath 可选，笔记的完整文件路径，用于将相对路径转换为绝对路径
   */
  markdownToHTML: (markdown: string, notePath?: string) => Promise<string>;
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;
  saveHTMLFile: (filePath: string, htmlContent: string) => Promise<{ success: boolean }>;
  exportAsPDF: (htmlContent: string, filePath: string, notePath?: string) => Promise<{ success: boolean }>;
  exportAsImage: (
    htmlContent: string,
    filePath: string,
    notePath?: string,
    options?: { width?: number }
  ) => Promise<{ success: boolean }>;
  getDownloadsPath: () => Promise<string>;
  inlineCSS: (htmlContent: string) => Promise<string>;
  copyHTMLToClipboard: (htmlContent: string) => Promise<{ success: boolean }>;
  exportHTMLPackage: (
    htmlContent: string,
    outputPath: string,
    notePath: string | undefined,
    assetsFolder?: string
  ) => Promise<{
    filesCount: number;
    copiedFiles: string[];
  }>;
  exportAsPDFPages: (
    htmlContents: string[],
    filePath: string,
    notePath?: string
  ) => Promise<{
    pagesCount: number;
  }>;
  exportAsImagePages: (
    htmlContents: string[],
    folderPath: string,
    baseFileName: string,
    notePath?: string,
    options?: { width?: number }
  ) => Promise<{
    filesCount: number;
    filePaths: string[];
  }>;
  /**
   * 获取字体文件的 base64 编码（用于 PDF/图片导出时内嵌字体）
   */
  getFontsBase64: () => Promise<{
    lxgwBase64: string;
    jetBrainsBase64: string;
  }>;
}

// 工具 API 接口
export interface UtilsAPI {
  /**
   * 获取拖拽文件的本地路径
   * 用于处理文件拖拽到编辑器的场景
   */
  getPathForFile: (file: File) => string;
}

// 配置 API 接口
export interface ConfigAPI {
  /**
   * 获取工作区的置顶笔记列表
   */
  getPinnedNotes: (workspacePath: string) => Promise<string[]>;

  /**
   * 设置工作区的置顶笔记列表
   */
  setPinnedNotes: (workspacePath: string, noteIds: string[]) => Promise<void>;
}

// RSS API 接口
export interface RssAPI {
  import: (
    url: string,
    workspacePath: string
  ) => Promise<{
    folderName: string;
    folderPath: string;
    itemCount: number;
  }>;
  update: (folderPath: string) => Promise<{ addedCount: number }>;
  unsubscribe: (folderPath: string) => Promise<{ success: boolean }>;
}

// 扩展的 API 接口
export interface API {
  theme: ThemeAPI;
  workspace: WorkspaceAPI;
  file: FileAPI;
  folder: FolderAPI;
  shell: ShellAPI;
  export: ExportAPI;
  window: WindowAPI;
  utils: UtilsAPI;
  config: ConfigAPI;
  rss: RssAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}
