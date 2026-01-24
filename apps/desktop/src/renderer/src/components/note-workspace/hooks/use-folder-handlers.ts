import { useNoteStore, useWorkspaceStore } from "@/stores";

export interface FolderHandlers {
  handleCreateFolder: () => void;
  handleShowFolderInExplorer: (folder: { id: string; name: string; noteCount?: number }) => Promise<void>;
  handleDeleteFolder: (folder: { id: string; name: string; noteCount?: number }) => Promise<void>;
  handleRenameFolder: (folder: { id: string; name: string; noteCount?: number }) => void;
}

interface UseFolderHandlersProps {
  onOpenCreateDialog: () => void;
  onOpenRenameDialog: (folder: { id: string; name: string; noteCount?: number }) => void;
}

/**
 * 文件夹操作 Hook
 * 处理所有文件夹相关的操作
 */
export function useFolderHandlers({
  onOpenCreateDialog,
  onOpenRenameDialog
}: UseFolderHandlersProps): FolderHandlers {
  const deleteFolder = useNoteStore((state) => state.deleteFolder);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // 处理新建文件夹 - 打开对话框
  const handleCreateFolder = () => {
    onOpenCreateDialog();
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
      await window.api.folder.delete(folderPath);
      deleteFolder(folder.id);
    } catch (error) {
      console.error("删除文件夹失败:", error);
    }
  };

  // 重命名文件夹 - 打开对话框
  const handleRenameFolder = (folder: { id: string; name: string; noteCount?: number }) => {
    onOpenRenameDialog(folder);
  };

  return {
    handleCreateFolder,
    handleShowFolderInExplorer,
    handleDeleteFolder,
    handleRenameFolder
  };
}
