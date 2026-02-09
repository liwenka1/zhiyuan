import { create } from "zustand";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { configIpc } from "@/ipc";
import { DEFAULT_EXPORT_THEME_ID, resolveExportThemeId } from "@/features/export/lib/styles";

interface ExportThemeState {
  /** 当前导出主题预设 ID */
  exportThemeId: string;

  /** 设置导出主题（同步到主进程持久化） */
  setExportThemeId: (themeId: string) => Promise<void>;

  /** 初始化（从主进程读取持久化值） */
  initExportTheme: () => Promise<void>;
}

/**
 * 导出主题 Store
 *
 * 管理导出功能使用的颜色主题预设
 * 持久化通过 IPC → electron-store 实现
 */
export const useExportThemeStore = create<ExportThemeState>((set, get) => ({
  exportThemeId: DEFAULT_EXPORT_THEME_ID,

  setExportThemeId: async (themeId: string) => {
    const prevThemeId = get().exportThemeId;
    // 1. 立即更新本地状态（乐观更新）
    // themeId 合法性由 IPC handler 校验 + getExportThemeColors 兜底，此处无需 resolve
    set({ exportThemeId: themeId });

    // 2. 持久化到主进程，失败则回滚并提示用户
    await configIpc.setExportThemeId(themeId).catch((err) => {
      console.warn("[ExportThemeStore] Failed to persist exportThemeId, rolling back:", err);
      set({ exportThemeId: prevThemeId });
      toast.error(i18n.t("common:settings.exportThemeSaveFailed"));
    });
  },

  initExportTheme: async () => {
    try {
      const themeId = await configIpc.getExportThemeId();
      const nextThemeId = resolveExportThemeId(themeId);
      set({ exportThemeId: nextThemeId });

      // 持久化修正后的值（如旧值无效，写回默认值）
      if (nextThemeId !== themeId) {
        await configIpc.setExportThemeId(nextThemeId).catch(() => {});
      }
    } catch {
      // 出错时回退到默认主题
      set({ exportThemeId: DEFAULT_EXPORT_THEME_ID });
    }
  }
}));
