import { useState } from "react";
import { useNoteStore, useThemeStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export interface NoteHandlers {
  handleCreateNote: () => Promise<void>;
  handleShowNoteInExplorer: (note: {
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  }) => Promise<void>;
  handleDeleteNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleRenameNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  handleDuplicateNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleTogglePinNote: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
  handleExportNote: (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => Promise<void>;
  handleCopyToWechat: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => Promise<void>;
}

interface UseNoteHandlersProps {
  onOpenRenameDialog: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
}

/**
 * 笔记操作 Hook
 * 处理所有笔记相关的操作
 */
export function useNoteHandlers({ onOpenRenameDialog }: UseNoteHandlersProps): NoteHandlers {
  const { t } = useTranslation("note");
  const theme = useThemeStore((state) => state.theme);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useNoteStore((state) => state.selectedFolderId);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const duplicateNote = useNoteStore((state) => state.duplicateNote);
  const togglePinNote = useNoteStore((state) => state.togglePinNote);
  const exportNoteAsHTML = useNoteStore((state) => state.exportNoteAsHTML);
  const exportNoteAsPDF = useNoteStore((state) => state.exportNoteAsPDF);
  const exportNoteAsPDFPages = useNoteStore((state) => state.exportNoteAsPDFPages);
  const exportNoteAsImage = useNoteStore((state) => state.exportNoteAsImage);
  const exportNoteAsImagePages = useNoteStore((state) => state.exportNoteAsImagePages);
  const copyNoteToWechat = useNoteStore((state) => state.copyNoteToWechat);

  // 导出状态
  const [isExporting, setIsExporting] = useState(false);

  // 处理新建笔记
  const handleCreateNote = async () => {
    await createNote(selectedFolderId || undefined);
  };

  // 在文件管理器中显示笔记
  const handleShowNoteInExplorer = async (note: {
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  }) => {
    // 从 store 中获取完整的笔记信息（包含 filePath）
    const fullNote = notes.find((n) => n.id === note.id);
    if (fullNote?.filePath) {
      await window.api.shell.showItemInFolder(fullNote.filePath);
    }
  };

  // 删除笔记 - 直接删除
  const handleDeleteNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath) return;

    try {
      await window.api.file.delete(fullNote.filePath);
      deleteNote(note.id);
    } catch (error) {
      console.error("删除笔记失败:", error);
    }
  };

  // 重命名笔记 - 打开对话框
  const handleRenameNote = (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    onOpenRenameDialog(note);
  };

  // 复制笔记
  const handleDuplicateNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    try {
      await duplicateNote(note.id);
    } catch (error) {
      console.error("复制笔记失败:", error);
    }
  };

  // 切换置顶状态
  const handleTogglePinNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    try {
      await togglePinNote(note.id);
    } catch (error) {
      console.error("切换置顶状态失败:", error);
      toast.error(t("pin.failed"));
    }
  };

  // 导出笔记
  const handleExportNote = async (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => {
    // 防止重复导出
    if (isExporting) {
      toast.info(t("export.exportingWait"));
      return;
    }

    setIsExporting(true);
    toast.loading(t("export.exporting"), { id: "exporting" });

    try {
      const isDark = theme === "dark";
      if (format === "html") {
        await exportNoteAsHTML(note.id, isDark);
      } else if (format === "pdf") {
        await exportNoteAsPDF(note.id, isDark);
      } else if (format === "pdf-pages") {
        await exportNoteAsPDFPages(note.id, isDark);
      } else if (format === "image") {
        await exportNoteAsImage(note.id, isDark);
      } else if (format === "image-pages") {
        await exportNoteAsImagePages(note.id, isDark);
      }
      toast.success(t("export.success"), { id: "exporting" });
    } catch (error) {
      // 用户取消导出，不显示错误
      if (error instanceof Error && error.message === "USER_CANCELLED") {
        toast.dismiss("exporting");
        return;
      }
      console.error("导出笔记失败:", error);
      toast.error(t("export.failed"), { id: "exporting" });
    } finally {
      setIsExporting(false);
    }
  };

  // 复制笔记到微信公众号
  const handleCopyToWechat = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    try {
      await copyNoteToWechat(note.id);
      toast.success(t("export.wechatSuccess"));
    } catch (error) {
      console.error("复制到微信公众号失败:", error);
      toast.error(t("export.wechatFailed"));
    }
  };

  return {
    handleCreateNote,
    handleShowNoteInExplorer,
    handleDeleteNote,
    handleRenameNote,
    handleDuplicateNote,
    handleTogglePinNote,
    handleExportNote,
    handleCopyToWechat
  };
}
