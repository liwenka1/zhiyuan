/**
 * 文件夹类型
 */
export interface Folder {
  id: string;
  name: string;
  path?: string; // 文件夹路径
  noteCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 笔记类型
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  fileName?: string; // 文件名
  filePath?: string; // 文件路径
  folderId?: string | null; // 所属文件夹 ID，null 表示根目录
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 笔记编辑器类型
 */
export interface EditorState {
  content: string;
  hasUnsavedChanges: boolean;
}

/**
 * 页面级视图模式
 * note: 笔记页面（三栏布局）
 */
export type ViewMode = "note";

/**
 * 编辑区视图模式
 * edit: 编辑模式
 * preview: 预览模式
 */
export type EditorViewMode = "edit" | "preview";

/**
 * 预览配置
 */
export interface PreviewConfig {
  showToc: boolean; // 是否显示目录
  syncScroll: boolean; // 是否同步滚动（分屏模式）
}
