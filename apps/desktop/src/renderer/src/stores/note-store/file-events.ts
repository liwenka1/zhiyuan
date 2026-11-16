import type { NoteStoreGet, NoteStoreSet } from "./types";
import { handleFileAdded, handleFileChanged } from "@/lib/file-watcher";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import { clearPendingSave, getLastSavedContent, setLastSavedContent, wasRecentlySaved } from "./persistence";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

export function createFileEventHandlers(set: NoteStoreSet, get: NoteStoreGet) {
  const pendingFileReads = new Map<string, symbol>();
  const pendingFileAdds = new Map<string, symbol>();

  return {
    handleFileAddedEvent: async (filePath: string, fullPath: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) return;

      const readToken = Symbol("file-add-read");
      pendingFileAdds.set(filePath, readToken);
      try {
        const newNote = await handleFileAdded(filePath, fullPath, workspacePath, get().notes);
        if (
          !newNote ||
          pendingFileAdds.get(filePath) !== readToken ||
          useWorkspaceStore.getState().workspacePath !== workspacePath ||
          get().notes.some((note) => note.id === newNote.id)
        ) {
          return;
        }

        set((state) => {
          state.notes.push(newNote);
        });
        setLastSavedContent(newNote.id, newNote.content);

        if (newNote.folderId) {
          const folderStore = useFolderStore.getState();
          folderStore.setFolders(
            folderStore.folders.map((folder) =>
              folder.id === newNote.folderId ? { ...folder, noteCount: (folder.noteCount || 0) + 1 } : folder
            )
          );
        }
      } finally {
        if (pendingFileAdds.get(filePath) === readToken) pendingFileAdds.delete(filePath);
      }
    },

    handleFileDeletedEvent: (filePath: string) => {
      pendingFileReads.delete(filePath);
      pendingFileAdds.delete(filePath);
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const lastSavedContent = getLastSavedContent(filePath) ?? note.content;
      const displayedContent = get().selectedNoteId === filePath ? get().editorContent : note.content;
      if (note.content !== lastSavedContent || displayedContent !== lastSavedContent) {
        toast.warning(i18n.t("note:errors.externalChangeConflict"));
        return;
      }

      const folderId = note.folderId;
      clearPendingSave(filePath);

      set((state) => {
        state.notes = state.notes.filter((n) => n.id !== filePath);
        state.openNoteIds = state.openNoteIds.filter((id) => id !== filePath);
        state.playingNoteIds = state.playingNoteIds.filter((id) => id !== filePath);

        if (state.selectedNoteId === filePath) {
          state.selectedNoteId = null;
          state.editorContent = "";
        }
      });

      if (folderId) {
        const folderStore = useFolderStore.getState();
        folderStore.setFolders(
          folderStore.folders.map((folder) =>
            folder.id === folderId ? { ...folder, noteCount: Math.max(0, (folder.noteCount || 0) - 1) } : folder
          )
        );
      }
    },

    handleFileChangedEvent: async (filePath: string, fullPath: string) => {
      pendingFileReads.delete(filePath);
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === filePath);
      if (!workspacePath || !note || note.filePath !== fullPath) return;

      const { selectedNoteId, editorContent, savingNoteIds } = get();
      const originalContent = note.content;
      const originalUpdatedAt = note.updatedAt;
      const lastSavedContent = getLastSavedContent(filePath) ?? originalContent;
      const displayedContent = selectedNoteId === filePath ? editorContent : originalContent;

      if (originalContent !== lastSavedContent || displayedContent !== lastSavedContent) {
        toast.warning(i18n.t("note:errors.externalChangeConflict"));
        return;
      }

      if (savingNoteIds.has(filePath)) {
        return;
      }

      if (wasRecentlySaved(filePath)) {
        return;
      }

      const readToken = Symbol("file-change-read");
      pendingFileReads.set(filePath, readToken);
      try {
        const content = await handleFileChanged(filePath, fullPath);
        if (content === null || pendingFileReads.get(filePath) !== readToken) return;

        // 文件读取期间可能发生输入、切换工作区或重命名，迟到的结果不能覆盖新状态。
        const current = get();
        const currentNote = current.notes.find((item) => item.id === filePath);
        if (
          useWorkspaceStore.getState().workspacePath !== workspacePath ||
          !currentNote ||
          currentNote.filePath !== fullPath
        ) {
          return;
        }
        if (current.savingNoteIds.has(filePath) || wasRecentlySaved(filePath)) return;

        const currentSavedContent = getLastSavedContent(filePath) ?? lastSavedContent;
        const currentDisplayedContent =
          current.selectedNoteId === filePath ? current.editorContent : currentNote.content;
        if (
          currentNote.content !== originalContent ||
          currentNote.updatedAt !== originalUpdatedAt ||
          currentNote.content !== currentSavedContent ||
          currentDisplayedContent !== currentSavedContent
        ) {
          toast.warning(i18n.t("note:errors.externalChangeConflict"));
          return;
        }

        set((state) => {
          const targetNote = state.notes.find((n) => n.id === filePath);
          if (targetNote) {
            targetNote.content = content;
            targetNote.updatedAt = new Date().toISOString();
            targetNote.github = parseGitHubMetadata(content);
            if (state.selectedNoteId === filePath) {
              state.editorContent = content;
            }
            setLastSavedContent(filePath, content);
          }
        });
      } finally {
        if (pendingFileReads.get(filePath) === readToken) {
          pendingFileReads.delete(filePath);
        }
      }
    }
  };
}
