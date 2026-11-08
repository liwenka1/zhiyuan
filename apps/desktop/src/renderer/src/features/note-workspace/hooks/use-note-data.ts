import { useMemo } from "react";
import { useNoteStore, useFolderStore } from "@/stores";

const searchContentCache = new Map<string, { content: string; normalized: string }>();
const MAX_SEARCH_CACHE_ENTRIES = 10_000;

function getNormalizedContent(note: { id: string; content: string }): string {
  const cached = searchContentCache.get(note.id);
  if (cached?.content === note.content) return cached.normalized;

  const normalized = note.content.toLocaleLowerCase();
  if (searchContentCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = searchContentCache.keys().next().value;
    if (oldestKey) searchContentCache.delete(oldestKey);
  }
  searchContentCache.set(note.id, { content: note.content, normalized });
  return normalized;
}

/**
 * 笔记数据派生 Hook
 * 负责过滤、排序等数据处理逻辑
 */
export function useNoteData() {
  const folders = useFolderStore((state) => state.folders);
  const notes = useNoteStore((state) => state.notes);
  const selectedFolderId = useFolderStore((state) => state.selectedFolderId);
  const searchKeyword = useNoteStore((state) => state.searchKeyword);

  // 根据选中的文件夹过滤笔记，如果没有选中文件夹则显示所有笔记
  const filteredNotes = useMemo(() => {
    let filtered = selectedFolderId ? notes.filter((note) => note.folderId === selectedFolderId) : notes;

    // 根据搜索关键词过滤笔记（搜索标题和内容）
    const keyword = searchKeyword.trim().toLocaleLowerCase();
    if (keyword) {
      filtered = filtered.filter(
        (note) => note.title.toLocaleLowerCase().includes(keyword) || getNormalizedContent(note).includes(keyword)
      );
    }

    return filtered;
  }, [notes, selectedFolderId, searchKeyword]);

  // 格式化笔记列表数据（置顶笔记排在前面，相同状态下按更新时间排序）
  const formattedNotes = useMemo(() => {
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
  }, [filteredNotes]);

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
