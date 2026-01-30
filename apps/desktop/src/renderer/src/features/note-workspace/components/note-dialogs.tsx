import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InputDialog } from "@renderer/components/input-dialog";
import { useNoteStore, useFolderStore, useWorkspaceStore } from "@/stores";

interface NoteDialogsProps {
  // 创建文件夹
  showCreateFolderDialog: boolean;
  onCloseCreateFolderDialog: () => void;

  // RSS 导入
  showRssImportDialog: boolean;
  onCloseRssImportDialog: () => void;

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
  showRssImportDialog,
  onCloseRssImportDialog,
  showRenameNoteDialog,
  noteToRename,
  onCloseRenameNoteDialog,
  showRenameFolderDialog,
  folderToRename,
  onCloseRenameFolderDialog
}: NoteDialogsProps) {
  const { t } = useTranslation("note");
  const createFolder = useFolderStore((state) => state.createFolder);
  const renameNote = useNoteStore((state) => state.renameNote);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 确认创建文件夹
  const handleConfirmCreateFolder = async (folderName: string) => {
    await createFolder(folderName);
  };

  const handleConfirmRssImport = async (url: string) => {
    if (!workspacePath) {
      toast.error(t("rss.noWorkspace"));
      return;
    }

    const toastId = "rss-import";
    toast.loading(t("rss.importing"), { id: toastId });

    try {
      await window.api.rss.import(url, workspacePath);
      toast.success(t("rss.success"), { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("rss.failed")}: ${errorMessage}`, { id: toastId });
    }
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

      {/* RSS 导入对话框 */}
      <InputDialog
        open={showRssImportDialog}
        onOpenChange={onCloseRssImportDialog}
        title={t("dialog.importRss.title")}
        description={t("dialog.importRss.description")}
        placeholder={t("dialog.importRss.placeholder")}
        onConfirm={handleConfirmRssImport}
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
