import type { NoteStoreGet, NoteStoreSet } from "./types";
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

export function createLoaders(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    loadFromFileSystem: async (data: { notes: Note[] }, expectedWorkspacePath?: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (expectedWorkspacePath && workspacePath !== expectedWorkspacePath) return;
      // 配置读取期间保存可能完成，先记录本地编辑，避免标记清除后接受旧扫描正文。
      const initial = get();
      const initialFileStates = new Map<string, { content: string; savedContent?: string; hasEdits: boolean }>();
      for (const note of initial.notes) {
        if (!note.filePath) continue;
        const content = initial.selectedNoteId === note.id ? initial.editorContent : note.content;
        initialFileStates.set(note.filePath, {
          content,
          savedContent: getLastSavedContent(note.id),
          hasEdits: hasLocalEdits(note, content)
        });
      }
      let pinnedNoteIds: string[] = [];

      if (workspacePath) {
        pinnedNoteIds = await configIpc.getPinnedNotes(workspacePath).catch(() => [] as string[]);
      }

      // 配置读取期间可能已切换工作区；先校验，避免污染另一个工作区的保存基线。
      if (useWorkspaceStore.getState().workspacePath !== workspacePath) return;

      const current = get();
      const currentNotes = new Map(current.notes.map((note) => [note.id, note]));
      const pinnedNoteIdSet = new Set(pinnedNoteIds);
      const notesWithPinState = data.notes.map((note) => {
        const existingNote = currentNotes.get(note.id);
        const localContent =
          current.selectedNoteId === note.id ? current.editorContent : (existingNote?.content ?? note.content);
        const initialFileState = note.filePath ? initialFileStates.get(note.filePath) : undefined;
        const changedWhileLoading =
          initialFileState &&
          (initialFileState.content !== localContent || initialFileState.savedContent !== getLastSavedContent(note.id));
        const preserveLocalContent = Boolean(
          existingNote &&
          note.filePath &&
          existingNote.filePath === note.filePath &&
          (initialFileState?.hasEdits || changedWhileLoading || hasLocalEdits(existingNote, localContent))
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
        isLoadingFromFileSystem: false,
        searchKeyword: preserveUiState ? current.searchKeyword : ""
      });
    }
  };
}
