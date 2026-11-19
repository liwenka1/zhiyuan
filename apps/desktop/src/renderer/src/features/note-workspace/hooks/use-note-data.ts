import { useMemo } from "react";
import { useNoteStore, useFolderStore } from "@/stores";

/**
 * 笔记数据派生 Hook
 * 负责过滤、排序等数据处理逻辑
 */
export function useNoteData() {
  const folders = useFolderStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  // 格式化笔记列表数据（置顶笔记排在前面，相同状态下按更新时间排序）
  const formattedNotes = useMemo(() => {
    const filteredNotes = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;
    return [...filteredNotes]
      .sort((a, b) => {
        // 1. 置顶笔记优先
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        // 2. 相同置顶状态下，按更新时间降序（最新的在前）
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      })
      .map((note) => ({
        id: note.id,
        title: note.title,
        filePath: note.filePath,
        updatedAt: note.updatedAt,
        isPinned: note.isPinned
      }));
  }, [notes, selectedFolderId]);

  // 单次遍历建立计数，避免每个文件夹都重新扫描全部笔记（O(F*N)）。
  const foldersWithCount = useMemo(() => {
    const noteCounts = new Map<string, number>();
    for (const note of notes) {
      if (note.folderId) noteCounts.set(note.folderId, (noteCounts.get(note.folderId) ?? 0) + 1);
    }

    return folders.map((folder) => ({
      ...folder,
      noteCount: noteCounts.get(folder.id) ?? 0
    }));
  }, [folders, notes]);

  return {
    formattedNotes,
    foldersWithCount
  };
}
