import { useMemo } from "react";
import { useNoteStore } from "@/stores";

/**
 * 笔记数据派生 Hook
 * 负责过滤、排序等数据处理逻辑
 */
export function useNoteData() {
  const folders = useNoteStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useNoteStore((state) => state.selectedFolderId);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);

  // 根据选中的文件夹过滤笔记，如果没有选中文件夹则显示所有笔记
  const filteredNotes = useMemo(() => {
    let filtered = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;

    // 根据搜索关键词过滤笔记（搜索标题和内容）
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (note) => note.title.toLowerCase().includes(keyword) || note.content.toLowerCase().includes(keyword)
      );
    }

    return filtered;
  }, [notes, selectedFolderId, searchKeyword]);

  // 格式化笔记列表数据（置顶笔记排在前面）
  const formattedNotes = useMemo(() => {
    return filteredNotes
      .sort((a, b) => {
        // 置顶笔记优先
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      })
      .map((note) => ({
        id: note.id,
        title: note.title,
        updatedAt: note.updatedAt,
        isPinned: note.isPinned
      }));
  }, [filteredNotes]);

  // 计算每个文件夹的真实笔记数量
  const foldersWithCount = useMemo(() => {
    return folders.map((folder) => ({
      ...folder,
      noteCount: notes.filter((note) => note.folderId === folder.id).length
    }));
  }, [folders, notes]);

  return {
    formattedNotes,
    foldersWithCount
  };
}
