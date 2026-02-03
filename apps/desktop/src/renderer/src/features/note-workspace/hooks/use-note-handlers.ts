import { useNoteStore, useFolderStore } from "@/stores";
import { useNoteExport } from "@/features/export";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { shellIpc, fileIpc } from "@/ipc";

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
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const createNote = useNoteStore((state) => state.createNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const duplicateNote = useNoteStore((state) => state.duplicateNote);
  const togglePinNote = useNoteStore((state) => state.togglePinNote);

  // 使用导出 hook
  const { exportNote, copyToWechat } = useNoteExport();

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
      try {
        await shellIpc.showItemInFolder(fullNote.filePath);
      } catch (error) {
        console.error("在文件管理器中显示失败:", error);
      }
    }
  };

  // 删除笔记 - 直接删除
  const handleDeleteNote = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote?.filePath) return;

    try {
      await fileIpc.delete(fullNote.filePath);
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
    // 从 store 中获取完整的笔记信息
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote) return;

    await exportNote(fullNote, format);
  };

  // 复制笔记到微信公众号
  const handleCopyToWechat = async (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
    // 从 store 中获取完整的笔记信息
    const fullNote = notes.find((n) => n.id === note.id);
    if (!fullNote) return;

    await copyToWechat(fullNote);
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
