import { useState } from "react";
import { Note } from "@/types";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useExportLayoutStore, useExportThemeStore } from "@/stores";
import {
  exportNoteAsHTML,
  exportNoteAsPDF,
  exportNoteAsPDFPages,
  exportNoteAsImage,
  exportNoteAsImagePages,
  copyNoteToWechat
} from "../lib";

export type ExportFormat = "html" | "pdf" | "pdf-pages" | "image" | "image-pages";

export interface UseNoteExportReturn {
  isExporting: boolean;
  exportNote: (note: Note, format: ExportFormat) => Promise<void>;
  copyToWechat: (note: Note) => Promise<void>;
}

/**
 * 笔记导出 Hook
 * 封装所有导出相关的逻辑
 */
export function useNoteExport(): UseNoteExportReturn {
  const { t } = useTranslation("note");
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [isExporting, setIsExporting] = useState(false);

  /**
   * 导出笔记
   */
  const exportNote = async (note: Note, format: ExportFormat) => {
    // 防止重复导出
    if (isExporting) {
      toast.info(t("export.exportingWait"));
      return;
    }

    setIsExporting(true);
    toast.loading(t("export.exporting"), { id: "exporting" });

    try {
      switch (format) {
        case "html":
          await exportNoteAsHTML(note, exportThemeId, exportLayout);
          break;
        case "pdf":
          await exportNoteAsPDF(note, exportThemeId, exportLayout);
          break;
        case "pdf-pages":
          await exportNoteAsPDFPages(note, exportThemeId, exportLayout);
          break;
        case "image":
          await exportNoteAsImage(note, exportThemeId, exportLayout);
          break;
        case "image-pages":
          await exportNoteAsImagePages(note, exportThemeId, exportLayout);
          break;
      }

      toast.success(t("export.success"), { id: "exporting" });
    } catch (error) {
      // 用户取消导出，不显示错误
      if (error instanceof Error && error.message === "USER_CANCELLED") {
        toast.dismiss("exporting");
        return;
      }
      toast.error(t("export.failed"), { id: "exporting" });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 复制笔记到微信公众号
   */
  const copyToWechat = async (note: Note) => {
    try {
      await copyNoteToWechat(note, exportThemeId, exportLayout);
      toast.success(t("export.wechatSuccess"));
    } catch {
      toast.error(t("export.wechatFailed"));
    }
  };

  return {
    isExporting,
    exportNote,
    copyToWechat
  };
}
