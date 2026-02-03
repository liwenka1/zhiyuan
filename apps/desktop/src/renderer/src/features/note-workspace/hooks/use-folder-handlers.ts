import { useFolderStore, useWorkspaceStore, useNoteStore } from "@/stores";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export interface FolderHandlers {
  handleCreateFolder: () => void;
  handleImportRss: () => void;
  handleUpdateRss: (folder: { id: string; name: string; noteCount?: number; isRss?: boolean }) => Promise<void>;
  handleUnsubscribeRss: (folder: { id: string; name: string; noteCount?: number; isRss?: boolean }) => Promise<void>;
  handleShowFolderInExplorer: (folder: { id: string; name: string; noteCount?: number }) => Promise<void>;
  handleDeleteFolder: (folder: { id: string; name: string; noteCount?: number }) => Promise<void>;
  handleRenameFolder: (folder: { id: string; name: string; noteCount?: number }) => void;
}

interface UseFolderHandlersProps {
  onOpenCreateDialog: () => void;
  onOpenRssImportDialog: () => void;
  onOpenRenameDialog: (folder: { id: string; name: string; noteCount?: number }) => void;
}

/**
 * 文件夹操作 Hook
 * 处理所有文件夹相关的操作
 */
export function useFolderHandlers({
  onOpenCreateDialog,
  onOpenRssImportDialog,
  onOpenRenameDialog
}: UseFolderHandlersProps): FolderHandlers {
  const { t } = useTranslation("sidebar");
  const folders = useFolderStore((state) => state.folders);
  const setFolders = useFolderStore((state) => state.setFolders);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 处理新建文件夹 - 打开对话框
  const handleCreateFolder = () => {
    onOpenCreateDialog();
  };

  const handleImportRss = () => {
    onOpenRssImportDialog();
  };

  const handleUpdateRss = async (folder: { id: string; name: string; noteCount?: number; isRss?: boolean }) => {
    if (!workspacePath || !folder.isRss) return;

    const folderPath = `${workspacePath}/${folder.name}`;
    const toastId = `rss-update-${folder.id}`;
    toast.loading(t("rss.updating"), { id: toastId });

    try {
      await window.api.watcher.pause();
      const result = await window.api.rss.update(folderPath);
      if (!result.ok) {
        toast.error(`${t("rss.updateFailed")}: ${result.error.message}`, { id: toastId });
        return;
      }
      const data = await window.api.workspace.scan(workspacePath);
      setFolders(data.folders);
      await loadFromFileSystem(data);
      if (result.value.addedCount > 0) {
        toast.success(t("rss.updated", { count: result.value.addedCount }), { id: toastId });
      } else {
        toast.success(t("rss.noUpdates"), { id: toastId });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("rss.updateFailed")}: ${errorMessage}`, { id: toastId });
    } finally {
      await window.api.watcher.resume();
    }
  };

  const handleUnsubscribeRss = async (folder: { id: string; name: string; noteCount?: number; isRss?: boolean }) => {
    if (!workspacePath || !folder.isRss) return;

    const folderPath = `${workspacePath}/${folder.name}`;
    const toastId = `rss-unsubscribe-${folder.id}`;
    toast.loading(t("rss.unsubscribing"), { id: toastId });

    try {
      const result = await window.api.rss.unsubscribe(folderPath);
      if (!result.ok) {
        toast.error(`${t("rss.unsubscribeFailed")}: ${result.error.message}`, { id: toastId });
        return;
      }
      setFolders(
        folders.map((item) =>
          item.id === folder.id
            ? {
                ...item,
                isRss: false,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      );
      toast.success(t("rss.unsubscribed"), { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("rss.unsubscribeFailed")}: ${errorMessage}`, { id: toastId });
    }
  };

  // 在文件管理器中显示文件夹
  const handleShowFolderInExplorer = async (folder: { id: string; name: string; noteCount?: number }) => {
    if (!workspacePath) return;
    const folderPath = `${workspacePath}/${folder.name}`;
    await window.api.shell.openPath(folderPath);
  };

  // 删除文件夹 - 直接删除
  const handleDeleteFolder = async (folder: { id: string; name: string; noteCount?: number }) => {
    if (!workspacePath) return;
    const folderPath = `${workspacePath}/${folder.name}`;

    try {
      await window.api.watcher.pause();
      await window.api.folder.delete(folderPath);
      const data = await window.api.workspace.scan(workspacePath);
      setFolders(data.folders);
      await loadFromFileSystem(data);
    } catch (error) {
      console.error("删除文件夹失败:", error);
    } finally {
      await window.api.watcher.resume();
    }
  };

  // 重命名文件夹 - 打开对话框
  const handleRenameFolder = (folder: { id: string; name: string; noteCount?: number }) => {
    onOpenRenameDialog(folder);
  };

  return {
    handleCreateFolder,
    handleImportRss,
    handleUpdateRss,
    handleUnsubscribeRss,
    handleShowFolderInExplorer,
    handleDeleteFolder,
    handleRenameFolder
  };
}
