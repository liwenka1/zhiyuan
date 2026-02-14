import type { NoteStoreGet, NoteStoreSet } from "./types";
import { MAX_OPEN_NOTES } from "./constants";
import type { Note } from "@/types";
import { formatMarkdown } from "@/lib/formatter";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import { fileIpc, configIpc } from "@/ipc";
import { clearDebouncedSave } from "./persistence";

export function createNoteActions(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    setNotes: (notes: Note[]) =>
      set((state) => {
        state.notes = notes;
        state.openNoteIds = state.openNoteIds.filter((id) => notes.some((note) => note.id === id));
      }),

    selectNote: (noteId: string) => {
      const { selectedNoteId, editorContent } = get();

      if (selectedNoteId && editorContent) {
        const currentNote = get().notes.find((n) => n.id === selectedNoteId);
        if (currentNote?.filePath) {
          clearDebouncedSave(selectedNoteId);
          get().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
      }

      const note = get().notes.find((n) => n.id === noteId);
      if (!note) return;

      set((state) => {
        state.openNoteIds = state.openNoteIds.filter((id) => id !== noteId);
        state.openNoteIds.push(noteId);

        if (state.openNoteIds.length > MAX_OPEN_NOTES) {
          state.openNoteIds.shift();
        }

        state.selectedNoteId = noteId;
        state.editorContent = note.content;
      });
    },

    setSearchKeyword: (keyword: string) => set({ searchKeyword: keyword }),

    createNote: async (folderId?: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;

      if (!workspacePath) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      try {
        const targetFolderId = folderId || useFolderStore.getState().selectedFolderId || null;

        const allNotes = get().notes;
        const defaultTitle = i18n.t("note:defaultTitle");
        const untitledPattern = new RegExp(`^${defaultTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`);
        const existingNumbers = allNotes
          .map((n) => {
            const match = n.title.match(untitledPattern);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => num > 0);

        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        const title = `${defaultTitle} ${nextNumber}`;
        const fileName = `${title}.md`;
        const content = `# ${title}\n\n${i18n.t("note:defaultContent")}`;

        let filePath: string;
        if (targetFolderId) {
          const folder = useFolderStore.getState().folders.find((f) => f.id === targetFolderId);
          if (folder?.path) {
            filePath = `${folder.path}/${fileName}`;
          } else {
            filePath = `${workspacePath}/${targetFolderId}/${fileName}`;
          }
        } else {
          filePath = `${workspacePath}/${fileName}`;
        }

        await fileIpc.create(filePath, content);

        const newNote: Note = {
          id: filePath.replace(workspacePath + "/", ""),
          title,
          content,
          fileName,
          filePath,
          folderId: targetFolderId || undefined,
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => {
          state.notes.push(newNote);
          state.openNoteIds = state.openNoteIds.filter((id) => id !== newNote.id);
          state.openNoteIds.push(newNote.id);

          if (state.openNoteIds.length > MAX_OPEN_NOTES) {
            state.openNoteIds.shift();
          }

          state.selectedNoteId = newNote.id;
          state.editorContent = newNote.content;
        });
      } catch {
        toast.error(i18n.t("note:errors.createNoteFailed"));
      }
    },

    formatCurrentNote: async () => {
      const { selectedNoteId, editorContent } = get();
      if (!selectedNoteId) return;

      try {
        const formattedContent = await formatMarkdown(editorContent);
        get().updateNoteContent(formattedContent);
      } catch {
        toast.error(i18n.t("note:errors.formatNoteFailed"));
      }
    },

    deleteNote: (noteId: string) => {
      set((state) => {
        state.notes = state.notes.filter((n) => n.id !== noteId);
        state.openNoteIds = state.openNoteIds.filter((id) => id !== noteId);
        state.playingNoteIds = state.playingNoteIds.filter((id) => id !== noteId);

        if (state.selectedNoteId === noteId) {
          state.selectedNoteId = null;
          state.editorContent = "";
        }
      });
    },

    renameNote: async (noteId: string, newTitle: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note?.filePath) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      try {
        const pathParts = note.filePath.split("/");
        const oldFileName = pathParts[pathParts.length - 1];
        const newFileName = `${newTitle}.md`;
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join("/");

        await fileIpc.rename(note.filePath, newFilePath);

        const newNoteId = note.id.replace(oldFileName, newFileName);
        set((state) => {
          const targetNote = state.notes.find((n) => n.id === noteId);
          if (targetNote) {
            targetNote.id = newNoteId;
            targetNote.title = newTitle;
            targetNote.fileName = newFileName;
            targetNote.filePath = newFilePath;
            targetNote.updatedAt = new Date().toISOString();
          }

          const openIndex = state.openNoteIds.indexOf(noteId);
          if (openIndex !== -1) {
            state.openNoteIds[openIndex] = newNoteId;
          }

          if (state.selectedNoteId === noteId) {
            state.selectedNoteId = newNoteId;
          }
        });
      } catch (error) {
        toast.error(i18n.t("note:errors.renameNoteFailed"));
        throw error;
      }
    },

    duplicateNote: async (noteId: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note?.filePath || !note.fileName) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      try {
        const allNotes = get().notes;
        const copySuffix = i18n.t("note:copySuffix");
        const copyPattern = new RegExp(`^${note.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${copySuffix} (\\d+)$`);
        const existingCopies = allNotes
          .map((n) => {
            const match = n.title.match(copyPattern);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => num > 0);

        const nextCopyNumber = existingCopies.length > 0 ? Math.max(...existingCopies) + 1 : 1;
        const newTitle = `${note.title} ${copySuffix} ${nextCopyNumber}`;
        const newFileName = `${newTitle}.md`;

        const pathParts = note.filePath.split("/");
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join("/");

        await fileIpc.copy(note.filePath, newFilePath);

        const newNoteId = note.id.replace(note.fileName, newFileName);
        const newNote: Note = {
          ...note,
          id: newNoteId,
          title: newTitle,
          fileName: newFileName,
          filePath: newFilePath,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => {
          state.notes.push(newNote);
        });
      } catch (error) {
        toast.error(i18n.t("note:errors.duplicateNoteFailed"));
        throw error;
      }
    },

    togglePinNote: async (noteId: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      try {
        const newPinnedState = !note.isPinned;

        set((state) => {
          const targetNote = state.notes.find((n) => n.id === noteId);
          if (targetNote) {
            targetNote.isPinned = newPinnedState;
          }
        });

        const allPinnedNotes = get()
          .notes.filter((n) => n.isPinned)
          .map((n) => n.id);
        await configIpc.setPinnedNotes(workspacePath, allPinnedNotes);
      } catch (error) {
        toast.error(i18n.t("note:pin.failed"));
        throw error;
      }
    },

    setNotePlaying: (noteId: string, isPlaying: boolean) => {
      set((state) => {
        if (isPlaying && !state.playingNoteIds.includes(noteId)) {
          state.playingNoteIds.push(noteId);
        } else if (!isPlaying && state.playingNoteIds.includes(noteId)) {
          state.playingNoteIds = state.playingNoteIds.filter((id) => id !== noteId);
        }
      });
    }
  };
}
