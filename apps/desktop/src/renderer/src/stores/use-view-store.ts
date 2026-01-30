import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EditorViewMode, PreviewConfig } from "@/types";

interface ViewStore {
  // 编辑区模式（edit / preview / split）
  editorMode: EditorViewMode;
  setEditorMode: (mode: EditorViewMode) => void;
  toggleEditorMode: (mode: EditorViewMode) => void;

  // 演示模式
  isPresentationMode: boolean;
  enterPresentationMode: () => void;
  exitPresentationMode: () => void;

  // 侧边栏显示控制（替代原来的 isFocusMode）
  showFolderSidebar: boolean;
  toggleFolderSidebar: () => void;

  // 笔记搜索状态
  isNoteSearchExpanded: boolean;
  setNoteSearchExpanded: (expanded: boolean) => void;

  // 分栏布局比例
  splitLayout: [number, number];
  setSplitLayout: (layout: [number, number]) => void;
  resetSplitLayout: () => void;

  // 预览配置
  previewConfig: PreviewConfig;
  setPreviewConfig: (config: Partial<PreviewConfig>) => void;
  toggleToc: () => void;
  toggleSyncScroll: () => void;

  // 工具方法
  isEditMode: () => boolean;
  isPreviewMode: () => boolean;
  isSplitMode: () => boolean;
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      editorMode: "edit",
      isPresentationMode: false,
      showFolderSidebar: true, // 默认显示文件夹侧边栏
      isNoteSearchExpanded: false, // 笔记搜索默认收起
      splitLayout: [50, 50],

      previewConfig: {
        showToc: true,
        syncScroll: true
      },

      // 编辑区模式切换
      setEditorMode: (mode) => set({ editorMode: mode }),

      toggleEditorMode: (mode) => {
        const currentMode = get().editorMode;
        set({ editorMode: currentMode === mode ? "edit" : mode });
      },

      // 演示模式
      enterPresentationMode: () => set({ isPresentationMode: true }),
      exitPresentationMode: () => set({ isPresentationMode: false }),

      // 侧边栏控制
      toggleFolderSidebar: () => set((state) => ({ showFolderSidebar: !state.showFolderSidebar })),

      // 笔记搜索状态
      setNoteSearchExpanded: (expanded) => set({ isNoteSearchExpanded: expanded }),

      // 分栏布局
      setSplitLayout: (layout) => set({ splitLayout: layout }),
      resetSplitLayout: () => set({ splitLayout: [50, 50] }),

      // 预览配置
      setPreviewConfig: (config) =>
        set((state) => ({
          previewConfig: { ...state.previewConfig, ...config }
        })),

      toggleToc: () =>
        set((state) => ({
          previewConfig: {
            ...state.previewConfig,
            showToc: !state.previewConfig.showToc
          }
        })),

      toggleSyncScroll: () =>
        set((state) => ({
          previewConfig: {
            ...state.previewConfig,
            syncScroll: !state.previewConfig.syncScroll
          }
        })),

      // 工具方法
      isEditMode: () => get().editorMode === "edit",
      isPreviewMode: () => get().editorMode === "preview",
      isSplitMode: () => get().editorMode === "split"
    }),
    {
      name: "view-storage",
      partialize: (state) => ({
        splitLayout: state.splitLayout,
        showFolderSidebar: state.showFolderSidebar // 持久化侧边栏状态
      })
    }
  )
);
