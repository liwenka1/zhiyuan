import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import { EditorViewMode, PreviewConfig } from "@/types";

interface ViewStore {
  // 编辑区模式（edit / preview / split）
  editorMode: EditorViewMode;
  setEditorMode: (mode: EditorViewMode) => void;
  toggleEditorMode: (mode: EditorViewMode) => void;
  setExclusiveMode: (mode: "edit" | "preview" | "split" | "exportPreview" | "presentation") => void;

  // 演示模式
  isPresentationMode: boolean;
  enterPresentationMode: () => void;
  exitPresentationMode: () => void;

  // 侧边栏显示控制（替代原来的 isFocusMode）
  showFolderSidebar: boolean;
  setShowFolderSidebar: (show: boolean) => void;
  toggleFolderSidebar: () => void;

  // 笔记搜索状态
  isNoteSearchExpanded: boolean;
  setNoteSearchExpanded: (expanded: boolean) => void;

  // 分栏布局比例
  splitLayout: [number, number];
  setSplitLayout: (layout: [number, number]) => void;
  resetSplitLayout: () => void;

  // 终端面板显示与尺寸
  isTerminalOpen: boolean;
  terminalHeight: number;
  setTerminalOpen: (open: boolean) => void;
  setTerminalHeight: (height: number) => void;

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
      isTerminalOpen: false,
      terminalHeight: 240,

      previewConfig: {
        showToc: true,
        syncScroll: true,
        exportPreview: false
      },

      // 编辑区模式切换
      setEditorMode: (mode) =>
        set(
          produce((draft) => {
            draft.editorMode = mode;
            draft.isPresentationMode = false;
            draft.previewConfig.exportPreview = false;
          })
        ),

      toggleEditorMode: (mode) => {
        const currentMode = get().editorMode;
        const nextMode = currentMode === mode ? "edit" : mode;
        set(
          produce((draft) => {
            draft.editorMode = nextMode;
            draft.isPresentationMode = false;
            draft.previewConfig.exportPreview = false;
          })
        );
      },

      setExclusiveMode: (mode) =>
        set(
          produce((draft) => {
            if (mode === "presentation") {
              draft.isPresentationMode = true;
              draft.editorMode = "edit";
              draft.previewConfig.exportPreview = false;
              draft.isTerminalOpen = false;
              return;
            }

            draft.isPresentationMode = false;
            if (mode === "exportPreview") {
              draft.editorMode = "preview";
              draft.previewConfig.exportPreview = true;
              return;
            }

            draft.editorMode = mode;
            draft.previewConfig.exportPreview = false;
          })
        ),

      // 演示模式
      enterPresentationMode: () => get().setExclusiveMode("presentation"),
      exitPresentationMode: () => set({ isPresentationMode: false }),

      // 侧边栏控制
      setShowFolderSidebar: (show) => set({ showFolderSidebar: show }),
      toggleFolderSidebar: () => set((state) => ({ showFolderSidebar: !state.showFolderSidebar })),

      // 笔记搜索状态
      setNoteSearchExpanded: (expanded) => set({ isNoteSearchExpanded: expanded }),

      // 分栏布局
      setSplitLayout: (layout) => set({ splitLayout: layout }),
      resetSplitLayout: () => set({ splitLayout: [50, 50] }),

      // 终端面板
      setTerminalOpen: (open) => set({ isTerminalOpen: open }),
      setTerminalHeight: (height) => set({ terminalHeight: Math.max(140, Math.min(640, Math.round(height))) }),

      // 预览配置
      setPreviewConfig: (config) =>
        set(
          produce((draft) => {
            Object.assign(draft.previewConfig, config);
            if (config.exportPreview === true) {
              draft.isPresentationMode = false;
              draft.editorMode = "preview";
            }
          })
        ),

      toggleToc: () =>
        set(
          produce((draft) => {
            draft.previewConfig.showToc = !draft.previewConfig.showToc;
          })
        ),

      toggleSyncScroll: () =>
        set(
          produce((draft) => {
            draft.previewConfig.syncScroll = !draft.previewConfig.syncScroll;
          })
        ),

      // 工具方法
      isEditMode: () => get().editorMode === "edit",
      isPreviewMode: () => get().editorMode === "preview",
      isSplitMode: () => get().editorMode === "split"
    }),
    {
      name: "view-storage",
      partialize: (state) => ({
        splitLayout: state.splitLayout,
        terminalHeight: state.terminalHeight
      })
    }
  )
);
