import type { NoteStoreGet, NoteStoreSet } from "./types";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { fileIpc } from "@/ipc";
import { parseGitHubMetadata } from "@/lib/github-metadata";

const debouncedSaves = new Map<string, ReturnType<typeof setTimeout>>();
const recentSaves = new Map<string, number>();
interface PendingSave {
  noteId: string;
  filePath: string;
  content: string;
}

const pendingContents = new Map<string, PendingSave>();
const saveQueues = new Map<string, Promise<void>>();
const lastSavedContents = new Map<string, string>();

export function setLastSavedContent(noteId: string, content: string): void {
  lastSavedContents.set(noteId, content);
}

export function getLastSavedContent(noteId: string): string | undefined {
  return lastSavedContents.get(noteId);
}

function getCurrentFilePath(get: NoteStoreGet, noteId: string): string | undefined {
  return get().notes.find((note) => note.id === noteId)?.filePath;
}

export function clearDebouncedSave(noteId: string, filePath?: string) {
  const keys = filePath
    ? [filePath]
    : Array.from(debouncedSaves.keys()).filter((key) => {
        return pendingContents.get(key)?.noteId === noteId;
      });
  for (const key of keys) {
    const timer = debouncedSaves.get(key);
    if (timer) clearTimeout(timer);
    debouncedSaves.delete(key);
  }
}

export function clearPendingSave(noteId: string, filePath?: string): void {
  for (const [key, pending] of pendingContents) {
    if (pending.noteId === noteId && (!filePath || pending.filePath === filePath)) {
      pendingContents.delete(key);
      const timer = debouncedSaves.get(key);
      if (timer) clearTimeout(timer);
      debouncedSaves.delete(key);
    }
  }
}

export function clearAllDebouncedSaves() {
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();
}

export async function flushAllDebouncedSaves(get: NoteStoreGet): Promise<void> {
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();

  const pending = Array.from(pendingContents.values());
  await Promise.all(pending.map((item) => get().saveNoteToFileSystem(item.noteId, item.content, item.filePath)));
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
  const performSave = async (pending: PendingSave): Promise<void> => {
    const currentNote = get().notes.find((note) => note.id === pending.noteId && note.filePath === pending.filePath);

    if (currentNote) {
      set((state) => {
        state.savingNoteIds.add(pending.noteId);
      });
      recordSaveTime(pending.noteId);
    }

    try {
      await fileIpc.write(pending.filePath, pending.content);
      if (pendingContents.get(pending.filePath)?.content === pending.content) {
        pendingContents.delete(pending.filePath);
      }
      setLastSavedContent(pending.noteId, pending.content);
    } finally {
      if (currentNote) {
        set((state) => {
          state.savingNoteIds.delete(pending.noteId);
        });
      }
    }
  };

  const enqueueSave = (pending: PendingSave): Promise<void> => {
    pendingContents.set(pending.filePath, pending);
    const previous = saveQueues.get(pending.filePath) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        const latest = pendingContents.get(pending.filePath);
        if (latest === undefined) return;
        await performSave(latest);
      });
    const tracked = next.finally(() => {
      if (saveQueues.get(pending.filePath) === tracked) {
        saveQueues.delete(pending.filePath);
      }
    });
    saveQueues.set(pending.filePath, tracked);
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

      const filePath = targetNote.filePath;
      pendingContents.set(filePath, { noteId: selectedNoteId, filePath, content });

      clearDebouncedSave(selectedNoteId, filePath);

      const timer = setTimeout(() => {
        void get()
          .saveNoteToFileSystem(selectedNoteId, content, filePath)
          .catch(() => {});
        debouncedSaves.delete(filePath);
      }, 500);

      debouncedSaves.set(filePath, timer);
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

      const filePath = targetNote.filePath;
      pendingContents.set(filePath, { noteId, filePath, content });

      clearDebouncedSave(noteId, filePath);

      const timer = setTimeout(() => {
        void get()
          .saveNoteToFileSystem(noteId, content, filePath)
          .catch(() => {});
        debouncedSaves.delete(filePath);
      }, 500);

      debouncedSaves.set(filePath, timer);
    },

    saveNoteToFileSystem: async (noteId, content, expectedFilePath?: string) => {
      const filePath = expectedFilePath ?? getCurrentFilePath(get, noteId);
      if (!filePath) return;
      try {
        await enqueueSave({ noteId, filePath, content });
      } catch (error) {
        set((state) => {
          state.savingNoteIds.delete(noteId);
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${errorMessage}`);
        throw error;
      }
    }
  };
}
