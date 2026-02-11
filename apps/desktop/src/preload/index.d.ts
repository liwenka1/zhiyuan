import { ElectronAPI } from "@electron-toolkit/preload";
import type { ExportLayoutConfig, Theme, ThemeMode, IpcResultDTO } from "@shared";

/**
 * 主题 API 接口
 */
export interface ThemeAPI {
  /**
   * 获取当前实际生效的主题（light / dark）
   */
  get: () => Promise<IpcResultDTO<Theme>>;

  /**
   * 获取用户设置的主题模式（light / dark / system）
   */
  getMode: () => Promise<IpcResultDTO<ThemeMode>>;

  /**
   * 设置主题模式
   */
  set: (theme: ThemeMode) => Promise<IpcResultDTO<void>>;

  /**
   * 监听主题变化（系统主题或用户设置变化）
   * @returns 取消监听函数
   */
  onChanged: (callback: (theme: Theme) => void) => () => void;
}

// 工作区 API 接口
export interface WorkspaceAPI {
  select: (options?: { title?: string; buttonLabel?: string }) => Promise<IpcResultDTO<string | null>>;
  openFile: (options?: {
    title?: string;
    buttonLabel?: string;
  }) => Promise<IpcResultDTO<{ filePath: string; workspacePath: string } | null>>;
  getCurrent: () => Promise<IpcResultDTO<string | null>>;
  scan: (workspacePath: string) => Promise<
    IpcResultDTO<{
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
    }>
  >;
  getRecent: () => Promise<IpcResultDTO<string[]>>;
  onMenuOpenFolder: (callback: () => void) => () => void;
  onMenuOpenFile: (callback: () => void) => () => void;
}

// 文件 API 接口
export interface FileAPI {
  read: (filePath: string) => Promise<IpcResultDTO<{ content: string; mtime: number }>>;
  write: (filePath: string, content: string) => Promise<IpcResultDTO<{ mtime: number }>>;
  create: (filePath: string, content: string) => Promise<IpcResultDTO<void>>;
  delete: (filePath: string) => Promise<IpcResultDTO<void>>;
  rename: (oldPath: string, newPath: string) => Promise<IpcResultDTO<void>>;
  copy: (sourcePath: string, destPath: string) => Promise<IpcResultDTO<void>>;
  onChanged: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
  onAdded: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
  onDeleted: (callback: (data: { filePath: string; fullPath: string }) => void) => () => void;
}

export interface WatcherAPI {
  pause: () => Promise<IpcResultDTO<void>>;
  resume: () => Promise<IpcResultDTO<void>>;
}

// 文件夹 API 接口
export interface FolderAPI {
  create: (folderPath: string) => Promise<IpcResultDTO<void>>;
  delete: (folderPath: string) => Promise<IpcResultDTO<void>>;
  rename: (oldPath: string, newPath: string) => Promise<IpcResultDTO<void>>;
  onAdded: (callback: (data: { folderPath: string; fullPath: string }) => void) => () => void;
  onDeleted: (callback: (data: { folderPath: string; fullPath: string }) => void) => () => void;
}

// Shell API 接口
export interface ShellAPI {
  showItemInFolder: (fullPath: string) => Promise<IpcResultDTO<void>>;
  openPath: (fullPath: string) => Promise<IpcResultDTO<void>>;
  openExternal: (url: string) => Promise<IpcResultDTO<void>>;
}

// 窗口 API 接口
export interface WindowAPI {
  /**
   * 设置窗口全屏状态
   */
  setFullScreen: (fullScreen: boolean) => Promise<IpcResultDTO<void>>;

  /**
   * 获取窗口全屏状态
   */
  isFullScreen: () => Promise<IpcResultDTO<boolean>>;

  /**
   * 新建窗口（显示欢迎页）
   */
  newWindow: () => Promise<IpcResultDTO<void>>;
}

// 导出 API 接口
export interface ExportAPI {
  showSaveDialog: (options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<IpcResultDTO<string | null>>;
  saveHTMLFile: (filePath: string, htmlContent: string) => Promise<IpcResultDTO<void>>;
  exportAsPDF: (htmlContent: string, filePath: string, notePath?: string) => Promise<IpcResultDTO<void>>;
  exportAsImage: (
    htmlContent: string,
    filePath: string,
    notePath?: string,
    options?: { width?: number }
  ) => Promise<IpcResultDTO<void>>;
  getDownloadsPath: () => Promise<IpcResultDTO<string>>;
  copyHTMLToClipboard: (htmlContent: string) => Promise<IpcResultDTO<void>>;
  exportHTMLPackage: (
    htmlContent: string,
    outputPath: string,
    notePath: string | undefined,
    assetsFolder?: string
  ) => Promise<
    IpcResultDTO<{
      filesCount: number;
      copiedFiles: string[];
    }>
  >;
  exportAsPDFPages: (
    htmlContents: string[],
    filePath: string,
    notePath?: string
  ) => Promise<
    IpcResultDTO<{
      pagesCount: number;
    }>
  >;
  exportAsImagePages: (
    htmlContents: string[],
    folderPath: string,
    baseFileName: string,
    notePath?: string,
    options?: { width?: number }
  ) => Promise<
    IpcResultDTO<{
      filesCount: number;
      filePaths: string[];
    }>
  >;
  /**
   * 获取字体文件的 base64 编码（用于 PDF/图片导出时内嵌字体）
   */
  getFontsBase64: () => Promise<
    IpcResultDTO<{
      lxgwBase64: string;
      jetBrainsBase64: string;
    }>
  >;
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
  getPinnedNotes: (workspacePath: string) => Promise<IpcResultDTO<string[]>>;

  /**
   * 设置工作区的置顶笔记列表
   */
  setPinnedNotes: (workspacePath: string, noteIds: string[]) => Promise<IpcResultDTO<void>>;

  /**
   * 获取导出主题预设 ID
   */
  getExportThemeId: () => Promise<IpcResultDTO<string>>;

  /**
   * 设置导出主题预设 ID
   */
  setExportThemeId: (themeId: string) => Promise<IpcResultDTO<void>>;

  /**
   * 获取导出布局配置
   */
  getExportLayout: () => Promise<IpcResultDTO<ExportLayoutConfig>>;

  /**
   * 设置导出布局配置（部分更新）
   */
  setExportLayout: (patch: Partial<ExportLayoutConfig>) => Promise<IpcResultDTO<void>>;
}

// RSS API 接口
export interface RssAPI {
  import: (
    url: string,
    workspacePath: string
  ) => Promise<
    IpcResultDTO<{
      folderName: string;
      folderPath: string;
      itemCount: number;
    }>
  >;
  update: (folderPath: string) => Promise<IpcResultDTO<{ addedCount: number }>>;
  unsubscribe: (folderPath: string) => Promise<IpcResultDTO<void>>;
}

// URL API 接口
export interface UrlAPI {
  createNote: (
    url: string,
    workspacePath: string,
    folderId?: string
  ) => Promise<
    IpcResultDTO<{
      noteId: string;
      filePath: string;
      title: string;
    }>
  >;
}

// API 集合接口
export interface API {
  theme: ThemeAPI;
  workspace: WorkspaceAPI;
  file: FileAPI;
  folder: FolderAPI;
  watcher: WatcherAPI;
  shell: ShellAPI;
  window: WindowAPI;
  export: ExportAPI;
  utils: UtilsAPI;
  config: ConfigAPI;
  rss: RssAPI;
  url: UrlAPI;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
  }
}
