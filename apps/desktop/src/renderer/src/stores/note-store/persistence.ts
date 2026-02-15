import type { NoteStoreGet, NoteStoreSet } from "./types";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { fileIpc } from "@/ipc";
import { parseGitHubMetadata } from "@/lib/github-metadata";

const debouncedSaves = new Map<string, ReturnType<typeof setTimeout>>();
const recentSaves = new Map<string, number>();

export function clearDebouncedSave(noteId: string) {
  const timer = debouncedSaves.get(noteId);
  if (timer) {
    clearTimeout(timer);
    debouncedSaves.delete(noteId);
  }
}

export function clearAllDebouncedSaves() {
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();
}

function recordSaveTime(noteId: string) {
  recentSaves.set(noteId, Date.now());
  setTimeout(() => {
    recentSaves.delete(noteId);
  }, 500);
}

export function wasRecentlySaved(noteId: string, withinMs = 500): boolean {
  const saveTime = recentSaves.get(noteId);
  if (!saveTime) return false;
  return Date.now() - saveTime < withinMs;
}

export function applyPersistence(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    updateNoteContent: (content) => {
      const { selectedNoteId } = get();
      if (!selectedNoteId) return;

      set((state) => {
        state.editorContent = content;

        const note = state.notes.find((n) => n.id === selectedNoteId);
        if (note) {
          note.content = content;
          note.updatedAt = new Date().toISOString();
          note.github = parseGitHubMetadata(content);
        }
      });

      const targetNote = get().notes.find((n) => n.id === selectedNoteId);
      if (!targetNote?.filePath) return;

      clearDebouncedSave(selectedNoteId);

      const timer = setTimeout(() => {
        get().saveNoteToFileSystem(selectedNoteId, content);
        debouncedSaves.delete(selectedNoteId);
      }, 500);

      debouncedSaves.set(selectedNoteId, timer);
    },

    updateNoteContentById: (noteId, content) => {
      set((state) => {
        const note = state.notes.find((n) => n.id === noteId);
        if (note) {
          note.content = content;
          note.updatedAt = new Date().toISOString();
          note.github = parseGitHubMetadata(content);
        }

        if (state.selectedNoteId === noteId) {
          state.editorContent = content;
        }
      });

      const targetNote = get().notes.find((n) => n.id === noteId);
      if (!targetNote?.filePath) return;

      clearDebouncedSave(noteId);

      const timer = setTimeout(() => {
        get().saveNoteToFileSystem(noteId, content);
        debouncedSaves.delete(noteId);
      }, 500);

      debouncedSaves.set(noteId, timer);
    },

    saveNoteToFileSystem: async (noteId, content) => {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note?.filePath) return;

      try {
        set((state) => {
          state.savingNoteIds.add(noteId);
        });
        recordSaveTime(noteId);

        await fileIpc.write(note.filePath, content);

        set((state) => {
          state.savingNoteIds.delete(noteId);
        });
      } catch (error) {
        set((state) => {
          state.savingNoteIds.delete(noteId);
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${errorMessage}`);
      }
    }
  };
}
