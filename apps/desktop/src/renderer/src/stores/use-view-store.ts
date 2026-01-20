import { create } from "zustand";
import { ViewMode, EditorViewMode, PreviewConfig } from "@/types";

interface ViewStore {
  // 页面级模式（note）
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // 编辑区模式（edit / preview）
  editorMode: EditorViewMode;
  setEditorMode: (mode: EditorViewMode) => void;
  toggleEditorMode: (mode: EditorViewMode) => void; // 切换模式（如果已是该模式则返回 edit）

  // 演示模式
  isPresentationMode: boolean;
  enterPresentationMode: () => void;
  exitPresentationMode: () => void;

  // 专注模式
  isFocusMode: boolean;
  toggleFocusMode: () => void;

  // 预览配置
  previewConfig: PreviewConfig;
  setPreviewConfig: (config: Partial<PreviewConfig>) => void;
  toggleToc: () => void;
  toggleSyncScroll: () => void;

  // 工具方法
  isNoteMode: () => boolean;
  isEditMode: () => boolean;
  isPreviewMode: () => boolean;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  // 初始状态
  viewMode: "note",
  editorMode: "edit",
  isPresentationMode: false,
  isFocusMode: false,

  previewConfig: {
    showToc: true,
    syncScroll: true
  },

  // 页面级模式切换
  setViewMode: (mode) => set({ viewMode: mode }),

  // 编辑区模式切换
  setEditorMode: (mode) => set({ editorMode: mode }),

  toggleEditorMode: (mode) => {
    const currentMode = get().editorMode;
    set({ editorMode: currentMode === mode ? "edit" : mode });
  },

  // 演示模式
  enterPresentationMode: () => set({ isPresentationMode: true }),
  exitPresentationMode: () => set({ isPresentationMode: false }),

  // 专注模式
  toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

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
  isNoteMode: () => get().viewMode === "note",
  isEditMode: () => get().editorMode === "edit",
  isPreviewMode: () => get().editorMode === "preview"
}));
