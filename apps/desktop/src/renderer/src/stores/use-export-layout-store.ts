import { create } from "zustand";
import { configIpc } from "@/ipc";
import { DEFAULT_EXPORT_LAYOUT_CONFIG, normalizeExportLayoutConfig, type ExportLayoutConfig } from "@shared";

interface ExportLayoutState {
  /** 当前导出布局配置 */
  exportLayout: ExportLayoutConfig;
  /** 设置导出布局（部分更新，同步持久化） */
  setExportLayout: (patch: Partial<ExportLayoutConfig>) => Promise<void>;
  /** 初始化导出布局（从持久化读取） */
  initExportLayout: () => Promise<void>;
}

export const useExportLayoutStore = create<ExportLayoutState>((set, get) => ({
  exportLayout: DEFAULT_EXPORT_LAYOUT_CONFIG,

  setExportLayout: async (patch: Partial<ExportLayoutConfig>) => {
    const prev = get().exportLayout;
    const next = normalizeExportLayoutConfig({ ...prev, ...patch });
    set({ exportLayout: next });

    await configIpc.setExportLayout(patch).catch(() => {
      // 持久化失败时回滚，避免 UI 与配置状态不一致
      set({ exportLayout: prev });
    });
  },

  initExportLayout: async () => {
    try {
      const persisted = await configIpc.getExportLayout();
      set({ exportLayout: normalizeExportLayoutConfig(persisted) });
    } catch {
      set({ exportLayout: DEFAULT_EXPORT_LAYOUT_CONFIG });
    }
  }
}));
