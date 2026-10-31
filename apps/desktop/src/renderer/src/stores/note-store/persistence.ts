import type { NoteStoreGet, NoteStoreSet } from "./types";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { fileIpc } from "@/ipc";
import { parseGitHubMetadata } from "@/lib/github-metadata";

const debouncedSaves = new Map<string, ReturnType<typeof setTimeout>>();
const recentSaves = new Map<string, number>();
const pendingContents = new Map<string, string>();
const saveQueues = new Map<string, Promise<void>>();
const lastSavedContents = new Map<string, string>();

export function setLastSavedContent(noteId: string, content: string): void {
  lastSavedContents.set(noteId, content);
}

export function getLastSavedContent(noteId: string): string | undefined {
  return lastSavedContents.get(noteId);
}

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

export async function flushAllDebouncedSaves(get: NoteStoreGet): Promise<void> {
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();

  const pending = Array.from(pendingContents.entries());
  await Promise.allSettled(pending.map(([noteId, content]) => get().saveNoteToFileSystem(noteId, content)));
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
  const performSave = async (noteId: string, content: string): Promise<void> => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note?.filePath) return;

    set((state) => {
      state.savingNoteIds.add(noteId);
    });
    recordSaveTime(noteId);

    try {
      await fileIpc.write(note.filePath, content);
      if (pendingContents.get(noteId) === content) {
        pendingContents.delete(noteId);
      }
      setLastSavedContent(noteId, content);
    } finally {
      set((state) => {
        state.savingNoteIds.delete(noteId);
      });
    }
  };

  const enqueueSave = (noteId: string, content: string): Promise<void> => {
    pendingContents.set(noteId, content);
    const previous = saveQueues.get(noteId) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const latest = pendingContents.get(noteId);
        if (latest === undefined) return;
        await performSave(noteId, latest);
      });
    const tracked = next.finally(() => {
      if (saveQueues.get(noteId) === tracked) {
        saveQueues.delete(noteId);
      }
    });
    saveQueues.set(noteId, tracked);
    return tracked;
  };

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

      pendingContents.set(selectedNoteId, content);

      clearDebouncedSave(selectedNoteId);

      const timer = setTimeout(() => {
        void get().saveNoteToFileSystem(selectedNoteId, content);
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

      pendingContents.set(noteId, content);

      clearDebouncedSave(noteId);

      const timer = setTimeout(() => {
        void get().saveNoteToFileSystem(noteId, content);
        debouncedSaves.delete(noteId);
      }, 500);

      debouncedSaves.set(noteId, timer);
    },

    saveNoteToFileSystem: async (noteId, content) => {
      try {
        await enqueueSave(noteId, content);
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
