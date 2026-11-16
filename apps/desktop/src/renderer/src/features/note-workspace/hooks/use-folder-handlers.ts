import { captureNoteLoadSnapshot } from "@/stores/note-store/loaders";
import { useFolderStore, useWorkspaceStore, useNoteStore } from "@/stores";
import { resolveFolderAbsolutePath, resolveFolderRelativePath } from "@/lib/workspace-paths";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { workspaceIpc, watcherIpc, folderIpc, shellIpc, rssIpc, configIpc } from "@/ipc";
import { flushAllDebouncedSaves } from "@/stores/note-store/persistence";

export interface FolderHandlers {
  handleCreateFolder: () => void;
  handleImportRss: () => void;
  handleUpdateRss: (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => Promise<void>;
  handleUnsubscribeRss: (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => Promise<void>;
  handleShowFolderInExplorer: (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
  }) => Promise<void>;
  handleDeleteFolder: (folder: { id: string; name: string; path?: string; noteCount?: number }) => Promise<void>;
  handleRenameFolder: (folder: { id: string; name: string; path?: string; noteCount?: number }) => void;
  handleCopyFolderRelativePath: (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => Promise<void>;
  handleCopyFolderAbsolutePath: (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => Promise<void>;
}

interface UseFolderHandlersProps {
  onOpenCreateDialog: () => void;
  onOpenRssImportDialog: () => void;
  onOpenRenameDialog: (folder: { id: string; name: string; path?: string; noteCount?: number }) => void;
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
  const { t } = useTranslation(["sidebar", "note"]);
  const setFolders = useFolderStore((state) => state.setFolders);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const isCurrentWorkspace = () => {
    const current = useWorkspaceStore.getState();
    return !current.isLoading && current.workspacePath === workspacePath;
  };

  // 处理新建文件夹 - 打开对话框
  const handleCreateFolder = () => {
    if (!isCurrentWorkspace()) return;
    onOpenCreateDialog();
  };

  const handleImportRss = () => {
    if (!isCurrentWorkspace()) return;
    onOpenRssImportDialog();
  };

  const handleUpdateRss = async (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => {
    if (!workspacePath || !folder.isRss || !isCurrentWorkspace()) return;

    const folderPath = folder.path || `${workspacePath}/${folder.name}`;
    const toastId = `rss-update-${folder.id}`;
    toast.loading(t("rss.updating"), { id: toastId });

    let didPause = false;
    try {
      await flushAllDebouncedSaves(useNoteStore.getState);
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      await watcherIpc.pause(workspacePath);
      didPause = true;
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      const result = await rssIpc.update(folderPath);
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      const beforeScan = captureNoteLoadSnapshot(useNoteStore.getState);
      const data = await workspaceIpc.scan(workspacePath);
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      if (!data) throw new Error("Workspace is already open in another window");
      setFolders(data.folders);
      await loadFromFileSystem(data, workspacePath, beforeScan);
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      const pinnedNoteIds = useNoteStore
        .getState()
        .notes.filter((note) => note.isPinned)
        .map((note) => note.id);
      await configIpc.setPinnedNotes(workspacePath, pinnedNoteIds);
      if (result.addedCount > 0) {
        toast.success(t("rss.updated", { count: result.addedCount }), { id: toastId });
      } else {
        toast.success(t("rss.noUpdates"), { id: toastId });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t("rss.updateFailed")}: ${errorMessage}`, { id: toastId });
    } finally {
      if (didPause) await watcherIpc.resume(workspacePath);
    }
  };

  const handleUnsubscribeRss = async (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => {
    if (!workspacePath || !folder.isRss || !isCurrentWorkspace()) return;

    const folderPath = folder.path || `${workspacePath}/${folder.name}`;
    const toastId = `rss-unsubscribe-${folder.id}`;
    toast.loading(t("rss.unsubscribing"), { id: toastId });

    try {
      await rssIpc.unsubscribe(folderPath);
      if (!isCurrentWorkspace()) {
        toast.dismiss(toastId);
        return;
      }
      setFolders(
        useFolderStore.getState().folders.map((item) =>
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

  const writePathToClipboard = async (text: string | null) => {
    if (!text) {
      toast.error(t("note:errors.copyPathFailed"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("note:pathCopied.single"));
    } catch {
      toast.error(t("note:errors.copyPathFailed"));
    }
  };

  const handleCopyFolderRelativePath = async (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => {
    const rel = resolveFolderRelativePath(folder, workspacePath);
    await writePathToClipboard(rel);
  };

  const handleCopyFolderAbsolutePath = async (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
    isRss?: boolean;
  }) => {
    const abs = resolveFolderAbsolutePath(folder, workspacePath);
    await writePathToClipboard(abs);
  };

  // 在文件管理器中显示文件夹
  const handleShowFolderInExplorer = async (folder: {
    id: string;
    name: string;
    path?: string;
    noteCount?: number;
  }) => {
    if (!workspacePath) return;
    const folderPath = folder.path || `${workspacePath}/${folder.name}`;
    try {
      await shellIpc.openPath(folderPath);
    } catch {
      toast.error(t("note:errors.showInExplorerFailed"));
    }
  };

  // 删除文件夹 - 直接删除
  const handleDeleteFolder = async (folder: { id: string; name: string; path?: string; noteCount?: number }) => {
    if (!isCurrentWorkspace()) return;
    if (!workspacePath) return;
    if (!window.confirm(t("note:confirmDeleteFolder", { name: folder.name }))) return;
    const folderPath = folder.path || `${workspacePath}/${folder.name}`;

    let didPause = false;
    try {
      await flushAllDebouncedSaves(useNoteStore.getState);
      if (!isCurrentWorkspace()) return;
      await watcherIpc.pause(workspacePath);
      didPause = true;
      if (!isCurrentWorkspace()) return;
      await folderIpc.delete(folderPath);
      if (!isCurrentWorkspace()) return;
      const beforeScan = captureNoteLoadSnapshot(useNoteStore.getState);
      const data = await workspaceIpc.scan(workspacePath);
      if (!isCurrentWorkspace()) return;
      if (!data) throw new Error("Workspace is already open in another window");
      setFolders(data.folders);
      await loadFromFileSystem(data, workspacePath, beforeScan);
      if (!isCurrentWorkspace()) return;
      const pinnedNoteIds = useNoteStore
        .getState()
        .notes.filter((note) => note.isPinned)
        .map((note) => note.id);
      await configIpc.setPinnedNotes(workspacePath, pinnedNoteIds);
    } catch {
      toast.error(t("note:errors.deleteFolderFailed"));
    } finally {
      if (didPause) await watcherIpc.resume(workspacePath);
    }
  };

  // 重命名文件夹 - 打开对话框
  const handleRenameFolder = (folder: { id: string; name: string; path?: string; noteCount?: number }) => {
    if (!isCurrentWorkspace()) return;
    onOpenRenameDialog(folder);
  };

  return {
    handleCreateFolder,
    handleImportRss,
    handleUpdateRss,
    handleUnsubscribeRss,
    handleShowFolderInExplorer,
    handleDeleteFolder,
    handleRenameFolder,
    handleCopyFolderRelativePath,
    handleCopyFolderAbsolutePath
  };
}
