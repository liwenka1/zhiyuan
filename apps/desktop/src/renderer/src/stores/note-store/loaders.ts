import type { NoteStoreGet, NoteStoreSet } from "./types";
import type { Note } from "@/types";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { useWorkspaceStore } from "../use-workspace-store";
import { configIpc } from "@/ipc";
import { setLastSavedContent } from "./persistence";

export function createLoaders(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    loadFromFileSystem: async (data: { notes: Note[] }) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      let pinnedNoteIds: string[] = [];

      if (workspacePath) {
        pinnedNoteIds = await configIpc.getPinnedNotes(workspacePath).catch(() => [] as string[]);
      }

      const notesWithPinState = data.notes.map((note) => ({
        ...note,
        isPinned: pinnedNoteIds.includes(note.id),
        github: parseGitHubMetadata(note.content)
      }));
      notesWithPinState.forEach((note) => setLastSavedContent(note.id, note.content));

      const current = get();
      const availableIds = new Set(notesWithPinState.map((note) => note.id));
      const selectedNoteId =
        current.selectedNoteId && availableIds.has(current.selectedNoteId) ? current.selectedNoteId : null;
      const currentSelected = selectedNoteId ? current.notes.find((note) => note.id === selectedNoteId) : undefined;
      const selectedNote = selectedNoteId ? notesWithPinState.find((note) => note.id === selectedNoteId) : undefined;
      const preserveUiState = Boolean(
        selectedNote && currentSelected && selectedNote.filePath === currentSelected.filePath
      );

      // 扫描期间不要用磁盘上的旧内容覆盖用户尚未落盘的编辑。
      if (preserveUiState && selectedNote && currentSelected && current.editorContent !== currentSelected.content) {
        selectedNote.content = current.editorContent;
        selectedNote.github = parseGitHubMetadata(current.editorContent);
      }

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
