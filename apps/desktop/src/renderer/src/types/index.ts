/**
 * 文件夹类型
 */
export interface Folder {
  id: string;
  name: string;
  path?: string; // 文件夹路径
  noteCount?: number;
  isRss?: boolean;
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
 * 编辑区视图模式
 * edit: 编辑模式
 * preview: 预览模式
 * split: 分栏模式（编辑器 + 预览）
 */
export type EditorViewMode = "edit" | "preview" | "split";

/**
 * 预览配置
 */
export interface PreviewConfig {
  showToc: boolean; // 是否显示目录
  syncScroll: boolean; // 是否同步滚动（分屏模式）
}
