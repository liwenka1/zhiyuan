import type { NoteStoreGet, NoteStoreSet } from "./types";
import { handleFileAdded, handleFileChanged } from "@/lib/file-watcher";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import { wasRecentlySaved } from "./persistence";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { toast } from "sonner";
import i18n from "@/lib/i18n";
import { getLastSavedContent, setLastSavedContent } from "./persistence";

export function createFileEventHandlers(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    handleFileAddedEvent: async (filePath: string, fullPath: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      if (!workspacePath) return;

      const newNote = await handleFileAdded(filePath, fullPath, workspacePath, get().notes);
      if (!newNote) return;

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
    },

    handleFileDeletedEvent: (filePath: string) => {
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const folderId = note.folderId;

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
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const { selectedNoteId, savingNoteIds } = get();

      if (selectedNoteId === filePath) {
        const selectedNote = get().notes.find((item) => item.id === filePath);
        const lastSavedContent = getLastSavedContent(filePath) ?? selectedNote?.content;
        if (selectedNote && lastSavedContent !== get().editorContent) {
          toast.warning(i18n.t("note:errors.externalChangeConflict"));
          return;
        }
      }

      if (savingNoteIds.has(filePath)) {
        return;
      }

      if (wasRecentlySaved(filePath)) {
        return;
      }

      const content = await handleFileChanged(filePath, fullPath);
      if (!content) return;

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
    }
  };
}
