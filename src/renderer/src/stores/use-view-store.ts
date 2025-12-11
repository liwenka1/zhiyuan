import { create } from "zustand";
import { ViewMode, EditorViewMode, PreviewConfig, PresentationConfig } from "@/types";

interface ViewStore {
  // 页面级模式（note 或 presentation）
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // 编辑区模式（edit / preview）
  editorMode: EditorViewMode;
  setEditorMode: (mode: EditorViewMode) => void;
  toggleEditorMode: (mode: EditorViewMode) => void; // 切换模式（如果已是该模式则返回 edit）

  // 预览配置
  previewConfig: PreviewConfig;
  setPreviewConfig: (config: Partial<PreviewConfig>) => void;
  toggleToc: () => void;
  toggleSyncScroll: () => void;

  // 幻灯片配置
  presentationConfig: PresentationConfig;
  setPresentationConfig: (config: Partial<PresentationConfig>) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  goToSlide: (index: number) => void;
  toggleAutoPlay: () => void;

  // 工具方法
  isNoteMode: () => boolean;
  isPresentationMode: () => boolean;
  isEditMode: () => boolean;
  isPreviewMode: () => boolean;
}

export const useViewStore = create<ViewStore>((set, get) => ({
  // 初始状态
  viewMode: "note",
  editorMode: "edit",

  previewConfig: {
    showToc: true,
    syncScroll: true
  },

  presentationConfig: {
    currentSlide: 0,
    totalSlides: 0,
    autoPlay: false,
    interval: 5
  },

  // 页面级模式切换
  setViewMode: (mode) => set({ viewMode: mode }),

  // 编辑区模式切换
  setEditorMode: (mode) => set({ editorMode: mode }),

  toggleEditorMode: (mode) => {
    const currentMode = get().editorMode;
    set({ editorMode: currentMode === mode ? "edit" : mode });
  },

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

  // 幻灯片配置
  setPresentationConfig: (config) =>
    set((state) => ({
      presentationConfig: { ...state.presentationConfig, ...config }
    })),

  nextSlide: () =>
    set((state) => {
      const { currentSlide, totalSlides } = state.presentationConfig;
      const nextIndex = Math.min(currentSlide + 1, totalSlides - 1);
      return {
        presentationConfig: {
          ...state.presentationConfig,
          currentSlide: nextIndex
        }
      };
    }),

  prevSlide: () =>
    set((state) => {
      const { currentSlide } = state.presentationConfig;
      const prevIndex = Math.max(currentSlide - 1, 0);
      return {
        presentationConfig: {
          ...state.presentationConfig,
          currentSlide: prevIndex
        }
      };
    }),

  goToSlide: (index) =>
    set((state) => ({
      presentationConfig: {
        ...state.presentationConfig,
        currentSlide: index
      }
    })),

  toggleAutoPlay: () =>
    set((state) => ({
      presentationConfig: {
        ...state.presentationConfig,
        autoPlay: !state.presentationConfig.autoPlay
      }
    })),

  // 工具方法
  isNoteMode: () => get().viewMode === "note",
  isPresentationMode: () => get().viewMode === "presentation",
  isEditMode: () => get().editorMode === "edit",
  isPreviewMode: () => get().editorMode === "preview"
}));
