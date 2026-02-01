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

  // URL 创建笔记
  showUrlCreateDialog: boolean;
  onCloseUrlCreateDialog: () => void;

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
  showUrlCreateDialog,
  onCloseUrlCreateDialog,
  showRenameNoteDialog,
  noteToRename,
  onCloseRenameNoteDialog,
  showRenameFolderDialog,
  folderToRename,
  onCloseRenameFolderDialog
}: NoteDialogsProps) {
  const { t } = useTranslation("note");
  const createFolder = useFolderStore((state) => state.createFolder);
  const setFolders = useFolderStore((state) => state.setFolders);
  const renameNote = useNoteStore((state) => state.renameNote);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);

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
      await window.api.watcher.pause();
      await window.api.rss.import(url, workspacePath);
      const data = await window.api.workspace.scan(workspacePath);
      setFolders(data.folders);
      await loadFromFileSystem(data);
      toast.success(t("rss.success"), { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("rss.failed")}: ${errorMessage}`, { id: toastId });
    } finally {
      await window.api.watcher.resume();
    }
  };

  // 确认从 URL 创建笔记
  const handleConfirmUrlCreate = async (url: string) => {
    if (!workspacePath) {
      toast.error(t("url.noWorkspace"));
      return;
    }

    const toastId = "url-create";
    toast.loading(t("url.creating"), { id: toastId });

    try {
      await window.api.watcher.pause();
      const selectedFolderId = useFolderStore.getState().selectedFolderId;
      await window.api.url.createNote(url, workspacePath, selectedFolderId || undefined);
      const data = await window.api.workspace.scan(workspacePath);
      await loadFromFileSystem(data);
      toast.success(t("url.success"), { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("url.failed")}: ${errorMessage}`, { id: toastId });
    } finally {
      await window.api.watcher.resume();
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

      {/* URL 创建笔记对话框 */}
      <InputDialog
        open={showUrlCreateDialog}
        onOpenChange={onCloseUrlCreateDialog}
        title={t("dialog.createFromUrl.title")}
        description={t("dialog.createFromUrl.description")}
        placeholder={t("dialog.createFromUrl.placeholder")}
        onConfirm={handleConfirmUrlCreate}
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
