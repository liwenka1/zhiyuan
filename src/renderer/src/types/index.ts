/**
 * 文件夹类型
 */
export interface Folder {
  id: string;
  name: string;
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
  folderId?: string;
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
 * presentation: 幻灯片演示（全屏）
 */
export type ViewMode = "note" | "presentation";

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

/**
 * 幻灯片配置
 */
export interface PresentationConfig {
  currentSlide: number; // 当前幻灯片索引
  totalSlides: number; // 总幻灯片数
  autoPlay: boolean; // 是否自动播放
  interval: number; // 自动播放间隔（秒）
}
