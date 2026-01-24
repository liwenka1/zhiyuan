import { useTranslation } from "react-i18next";
import { InputDialog } from "@renderer/components/input-dialog";
import { useNoteStore } from "@/stores";

interface NoteDialogsProps {
  // 创建文件夹
  showCreateFolderDialog: boolean;
  onCloseCreateFolderDialog: () => void;

  // 重命名笔记
  showRenameNoteDialog: boolean;
  noteToRename: { id: string; title: string; updatedAt?: string; isPinned?: boolean } | null;
  onCloseRenameNoteDialog: () => void;

  // 重命名文件夹
  showRenameFolderDialog: boolean;
  folderToRename: { id: string; name: string; noteCount?: number } | null;
  onCloseRenameFolderDialog: () => void;
}

/**
 * 笔记对话框组件
 * 包含：创建文件夹、重命名文件夹、重命名笔记
 */
export function NoteDialogs({
  showCreateFolderDialog,
  onCloseCreateFolderDialog,
  showRenameNoteDialog,
  noteToRename,
  onCloseRenameNoteDialog,
  showRenameFolderDialog,
  folderToRename,
  onCloseRenameFolderDialog
}: NoteDialogsProps) {
  const { t } = useTranslation("note");
  const createFolder = useNoteStore((state) => state.createFolder);
  const renameNote = useNoteStore((state) => state.renameNote);
  const renameFolder = useNoteStore((state) => state.renameFolder);

  // 确认创建文件夹
  const handleConfirmCreateFolder = async (folderName: string) => {
    await createFolder(folderName);
  };

  // 确认重命名笔记
  const handleConfirmRenameNote = async (newTitle: string) => {
    if (!noteToRename || !newTitle || newTitle === noteToRename.title) return;

    try {
      await renameNote(noteToRename.id, newTitle);
      onCloseRenameNoteDialog();
    } catch (error) {
      console.error("重命名笔记失败:", error);
    }
  };

  // 确认重命名文件夹
  const handleConfirmRenameFolder = async (newName: string) => {
    if (!folderToRename || !newName || newName === folderToRename.name) return;

    try {
      await renameFolder(folderToRename.id, newName);
      onCloseRenameFolderDialog();
    } catch (error) {
      console.error("重命名文件夹失败:", error);
    }
  };

  return (
    <>
      {/* 新建文件夹对话框 */}
      <InputDialog
        open={showCreateFolderDialog}
        onOpenChange={onCloseCreateFolderDialog}
        title={t("dialog.createFolder.title")}
        description={t("dialog.createFolder.description")}
        placeholder={t("dialog.createFolder.placeholder")}
        onConfirm={handleConfirmCreateFolder}
      />

      {/* 重命名文件夹对话框 */}
      <InputDialog
        open={showRenameFolderDialog}
        onOpenChange={onCloseRenameFolderDialog}
        title={t("dialog.renameFolder.title")}
        description={t("dialog.renameFolder.description")}
        placeholder={t("dialog.renameFolder.placeholder")}
        defaultValue={folderToRename?.name}
        onConfirm={handleConfirmRenameFolder}
      />

      {/* 重命名笔记对话框 */}
      <InputDialog
        open={showRenameNoteDialog}
        onOpenChange={onCloseRenameNoteDialog}
        title={t("dialog.renameNote.title")}
        description={t("dialog.renameNote.description")}
        placeholder={t("dialog.renameNote.placeholder")}
        defaultValue={noteToRename?.title}
        onConfirm={handleConfirmRenameNote}
      />
    </>
  );
}
