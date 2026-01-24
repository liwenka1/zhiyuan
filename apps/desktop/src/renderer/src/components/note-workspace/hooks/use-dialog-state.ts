import { useState } from "react";

/**
 * Dialog 状态管理 Hook
 */
export function useDialogState() {
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showRenameNoteDialog, setShowRenameNoteDialog] = useState(false);
  const [showRenameFolderDialog, setShowRenameFolderDialog] = useState(false);
  const [noteToRename, setNoteToRename] = useState<{
    id: string;
    title: string;
    updatedAt?: string;
    isPinned?: boolean;
  } | null>(null);
  const [folderToRename, setFolderToRename] = useState<{
    id: string;
    name: string;
    noteCount?: number;
  } | null>(null);

  return {
    // 创建文件夹对话框
    showCreateFolderDialog,
    openCreateFolderDialog: () => setShowCreateFolderDialog(true),
    closeCreateFolderDialog: () => setShowCreateFolderDialog(false),

    // 重命名笔记对话框
    showRenameNoteDialog,
    noteToRename,
    openRenameNoteDialog: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => {
      setNoteToRename(note);
      setShowRenameNoteDialog(true);
    },
    closeRenameNoteDialog: () => {
      setShowRenameNoteDialog(false);
      setNoteToRename(null);
    },

    // 重命名文件夹对话框
    showRenameFolderDialog,
    folderToRename,
    openRenameFolderDialog: (folder: { id: string; name: string; noteCount?: number }) => {
      setFolderToRename(folder);
      setShowRenameFolderDialog(true);
    },
    closeRenameFolderDialog: () => {
      setShowRenameFolderDialog(false);
      setFolderToRename(null);
    }
  };
}
