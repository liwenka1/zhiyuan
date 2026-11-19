import type { NoteLoadSnapshot, NoteStoreGet, NoteStoreSet } from "./types";
import type { Note } from "@/types";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { useWorkspaceStore } from "../use-workspace-store";
import { configIpc } from "@/ipc";
import { getLastSavedContent, hasPendingSave, setLastSavedContent } from "./persistence";

function hasLocalEdits(note: Note, content: string): boolean {
  const lastSavedContent = getLastSavedContent(note.id);
  return Boolean(
    (note.filePath && hasPendingSave(note.filePath)) || (lastSavedContent !== undefined && content !== lastSavedContent)
  );
}

function shouldPreserveContent(
  note: Note,
  content: string,
  initial: NoteLoadSnapshot,
  scanStartedEarlier: boolean
): boolean {
  const original = note.filePath ? initial.get(note.filePath) : undefined;
  return Boolean(
    hasLocalEdits(note, content) ||
    original?.hasEdits ||
    (original
      ? original.content !== content || original.savedContent !== getLastSavedContent(note.id)
      : scanStartedEarlier)
  );
}

// 必须在发出扫描请求之前调用，覆盖扫描与配置读取的整个异步区间。
export function captureNoteLoadSnapshot(get: NoteStoreGet): NoteLoadSnapshot {
  const initial = get();
  const snapshot = new Map<string, { content: string; savedContent?: string; hasEdits: boolean }>();
  for (const note of initial.notes) {
    if (!note.filePath) continue;
    const content = initial.selectedNoteId === note.id ? initial.editorContent : note.content;
    snapshot.set(note.filePath, {
      content,
      savedContent: getLastSavedContent(note.id),
      hasEdits: hasLocalEdits(note, content)
    });
  }
  return snapshot;
}

export function createLoaders(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    loadFromFileSystem: async (
      data: { notes: Note[] },
      expectedWorkspacePath?: string,
      beforeScan?: NoteLoadSnapshot
    ) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (expectedWorkspacePath && workspacePath !== expectedWorkspacePath) return;
      const initialFileStates = beforeScan ?? captureNoteLoadSnapshot(get);
      let pinnedNoteIds: string[] = [];

      if (workspacePath) {
        pinnedNoteIds = await configIpc.getPinnedNotes(workspacePath).catch(() => [] as string[]);
      }

      // 配置读取期间可能已切换工作区；先校验，避免污染另一个工作区的保存基线。
      if (useWorkspaceStore.getState().workspacePath !== workspacePath) return;

      const current = get();
      const currentNotes = new Map(current.notes.map((note) => [note.id, note]));
      const currentPaths = new Set(current.notes.map((note) => note.filePath));
      const pinnedNoteIdSet = new Set(pinnedNoteIds);
      // 已在本地删除或改名的文件也可能残留在早先的扫描快照里。
      const scannedNotes = data.notes.filter(
        (note) =>
          !beforeScan || !note.filePath || !initialFileStates.has(note.filePath) || currentPaths.has(note.filePath)
      );
      const notesWithPinState: Note[] = scannedNotes.map((note) => {
        const existingNote = currentNotes.get(note.id);
        const localContent =
          current.selectedNoteId === note.id ? current.editorContent : (existingNote?.content ?? note.content);
        const preserveLocalContent = Boolean(
          existingNote &&
          note.filePath &&
          existingNote.filePath === note.filePath &&
          shouldPreserveContent(existingNote, localContent, initialFileStates, Boolean(beforeScan))
        );
        const content = preserveLocalContent ? localContent : note.content;

        // 保留本地草稿时也保留其保存基线，不能把扫描快照误记成已保存内容。
        if (!preserveLocalContent) setLastSavedContent(note.id, note.content);
        return {
          ...note,
          content,
          updatedAt: preserveLocalContent ? existingNote?.updatedAt : note.updatedAt,
          isPinned: pinnedNoteIdSet.has(note.id),
          github: parseGitHubMetadata(content)
        };
      });

      // 扫描快照可能不含刚创建的文件，或已被外部删除但仍有本地草稿的文件。
      // 保留当前工作区内这些记录，不能因刷新把唯一的内存正文清掉。
      const scannedIds = new Set(scannedNotes.map((note) => note.id));
      const workspacePrefix = workspacePath ? `${workspacePath.replaceAll("\\", "/").replace(/\/+$/, "")}/` : null;
      for (const note of current.notes) {
        if (scannedIds.has(note.id) || !note.filePath || !workspacePrefix) continue;
        if (!note.filePath.replaceAll("\\", "/").startsWith(workspacePrefix)) continue;
        const content = current.selectedNoteId === note.id ? current.editorContent : note.content;
        if (shouldPreserveContent(note, content, initialFileStates, Boolean(beforeScan))) {
          notesWithPinState.push({ ...note, content, github: parseGitHubMetadata(content) });
        }
      }

      const availableIds = new Set(notesWithPinState.map((note) => note.id));
      const selectedNoteId =
        current.selectedNoteId && availableIds.has(current.selectedNoteId) ? current.selectedNoteId : null;
      const currentSelected = selectedNoteId ? current.notes.find((note) => note.id === selectedNoteId) : undefined;
      const selectedNote = selectedNoteId ? notesWithPinState.find((note) => note.id === selectedNoteId) : undefined;
      const preserveUiState = Boolean(
        selectedNote && currentSelected && selectedNote.filePath === currentSelected.filePath
      );

      set({
        notes: notesWithPinState,
        selectedNoteId: preserveUiState ? selectedNoteId : null,
        editorContent: preserveUiState && selectedNote ? selectedNote.content : "",
        openNoteIds: preserveUiState ? current.openNoteIds.filter((id) => availableIds.has(id)) : [],
        playingNoteIds: preserveUiState ? current.playingNoteIds.filter((id) => availableIds.has(id)) : [],
        isLoadingFromFileSystem: false
      });
    }
  };
}
