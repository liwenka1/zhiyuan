import type { NoteStoreGet, NoteStoreSet } from "./types";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { fileIpc } from "@/ipc";
import { parseGitHubMetadata, stripGitHubMetadata } from "@/lib/github-metadata";
import { useWorkspaceStore } from "../use-workspace-store";
import { beginFileOperation, isEditingBlocked, useOperationStore } from "./operation-guard";
import { assertNoSaveConflict, clearSaveConflict, setSaveConflict, useSaveConflictStore } from "./save-conflicts";

export { assertNoSaveConflict } from "./save-conflicts";

const debouncedSaves = new Map<string, ReturnType<typeof setTimeout>>();
interface PendingSave {
  noteId: string;
  filePath: string;
  content: string;
  expectedContent: string;
}

const pendingContents = new Map<string, PendingSave>();
const saveQueues = new Map<string, Promise<void>>();
const lastSavedContents = new Map<string, string>();
const activeWrites = new Map<string, string>();

export function isOwnSaveContent(filePath: string, content: string): boolean {
  return activeWrites.get(filePath) === content;
}

/** Keep the draft pending, but stop every writer until both versions are preserved. */
export function recordSaveConflict(
  noteId: string,
  filePath: string,
  localContent: string,
  diskContent: string | null | undefined
): void {
  clearDebouncedSave(noteId, filePath);
  setSaveConflict({ noteId, filePath, localContent, diskContent });
}

export function setLastSavedContent(noteId: string, content: string): void {
  lastSavedContents.set(noteId, content);
}

export function getLastSavedContent(noteId: string): string | undefined {
  return lastSavedContents.get(noteId);
}

export function hasPendingSave(filePath: string): boolean {
  return pendingContents.has(filePath);
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
  for (const filePath of Object.keys(useSaveConflictStore.getState().conflicts)) assertNoSaveConflict(filePath);
  debouncedSaves.forEach((timer) => clearTimeout(timer));
  debouncedSaves.clear();

  while (pendingContents.size > 0 || saveQueues.size > 0) {
    clearAllDebouncedSaves();
    const pending = Array.from(pendingContents.values());
    await Promise.all([
      ...pending.map((item) => get().saveNoteToFileSystem(item.noteId, item.content, item.filePath)),
      ...saveQueues.values()
    ]);
  }
  clearAllDebouncedSaves();
}

export function applyPersistence(set: NoteStoreSet, get: NoteStoreGet) {
  const performSave = async (pending: PendingSave): Promise<void> => {
    assertNoSaveConflict(pending.filePath);
    const currentNote = get().notes.find((note) => note.id === pending.noteId && note.filePath === pending.filePath);

    if (currentNote) {
      set((state) => {
        state.savingNoteIds.add(pending.noteId);
      });
    }

    try {
      activeWrites.set(pending.filePath, pending.content);
      await fileIpc.write(pending.filePath, pending.content, pending.expectedContent);
      if (pendingContents.get(pending.filePath)?.content === pending.content) {
        clearDebouncedSave(pending.noteId, pending.filePath);
        pendingContents.delete(pending.filePath);
      }
      const newer = pendingContents.get(pending.filePath);
      if (newer) newer.expectedContent = pending.content;
      if (get().notes.some((note) => note.id === pending.noteId && note.filePath === pending.filePath)) {
        setLastSavedContent(pending.noteId, pending.content);
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "FILE_CONTENT_CONFLICT" || code === "FILE_NOT_FOUND") {
        const note = get().notes.find((item) => item.id === pending.noteId && item.filePath === pending.filePath);
        const localContent = note
          ? get().selectedNoteId === note.id
            ? get().editorContent
            : note.content
          : (pendingContents.get(pending.filePath)?.content ?? pending.content);
        // Pause synchronously; an asynchronous read must not leave a writer free to retry.
        const existingConflict = useSaveConflictStore.getState().conflicts[pending.filePath];
        const diskContent = code === "FILE_NOT_FOUND" ? null : existingConflict?.diskContent;
        recordSaveConflict(pending.noteId, pending.filePath, localContent, diskContent);
        if (diskContent === undefined) {
          const disk = await fileIpc.read(pending.filePath).catch(() => null);
          const currentConflict = useSaveConflictStore.getState().conflicts[pending.filePath];
          if (disk && currentConflict && currentConflict.diskContent === undefined) {
            setSaveConflict({ ...currentConflict, diskContent: disk.content });
          }
        }
      }
      throw error;
    } finally {
      activeWrites.delete(pending.filePath);
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

  const queueDraft = (noteId: string, filePath: string, content: string, previousContent: string): void => {
    const expectedContent =
      pendingContents.get(filePath)?.expectedContent ?? getLastSavedContent(noteId) ?? previousContent;
    pendingContents.set(filePath, { noteId, filePath, content, expectedContent });
    clearDebouncedSave(noteId, filePath);
    const conflict = useSaveConflictStore.getState().conflicts[filePath];
    if (conflict) {
      setSaveConflict({ ...conflict, localContent: content });
      return;
    }
    const timer = setTimeout(() => {
      void get()
        .saveNoteToFileSystem(noteId, content, filePath)
        .catch(() => {});
      debouncedSaves.delete(filePath);
    }, 500);
    debouncedSaves.set(filePath, timer);
  };

  return {
    updateNoteContent: (content) => {
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const { selectedNoteId } = get();
      if (!selectedNoteId) return;
      const previousContent = get().notes.find((note) => note.id === selectedNoteId)?.content ?? get().editorContent;

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

      queueDraft(selectedNoteId, targetNote.filePath, content, previousContent);
    },

    updateNoteContentById: (noteId, content) => {
      if (useWorkspaceStore.getState().isLoading || useOperationStore.getState().fileOperationCount > 0) return;
      const previousContent = get().notes.find((note) => note.id === noteId)?.content ?? content;
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

      queueDraft(noteId, targetNote.filePath, content, previousContent);
    },

    saveNoteToFileSystem: async (noteId, content, expectedFilePath?: string) => {
      const filePath = expectedFilePath ?? getCurrentFilePath(get, noteId);
      if (!filePath) return;
      try {
        assertNoSaveConflict(filePath);
        const note = get().notes.find((item) => item.id === noteId && item.filePath === filePath);
        const expectedContent =
          pendingContents.get(filePath)?.expectedContent ?? getLastSavedContent(noteId) ?? note?.content;
        if (expectedContent === undefined) throw new Error("The file has no saved baseline");
        await enqueueSave({ noteId, filePath, content, expectedContent });
      } catch (error) {
        set((state) => {
          state.savingNoteIds.delete(noteId);
        });

        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`${i18n.t("note:errors.saveNoteFailed")}: ${errorMessage}`);
        throw error;
      }
    },

    resolveSaveConflict: async (filePath: string, saveAsTitle?: string, existingFileMessage?: string) => {
      const release = beginFileOperation();
      if (!release) throw new Error("Wait for the current file operation to finish");
      try {
        const conflict = useSaveConflictStore.getState().conflicts[filePath];
        if (!conflict) return null;
        await Promise.allSettled([saveQueues.get(filePath)]);
        const note = get().notes.find((item) => item.filePath === filePath);
        if (!/\.md$/i.test(filePath)) throw new Error("Only Markdown notes can be recovered");
        const localContent =
          note && get().selectedNoteId === note.id ? get().editorContent : (note?.content ?? conflict.localContent);
        const backupContent = stripGitHubMetadata(localContent);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sourceFileName = filePath.split(/[\\/]/).pop()!;
        const directory = filePath.slice(0, -sourceFileName.length);
        // Leave room for the recovery suffix even when the original filename is near the filesystem limit.
        const stem = Array.from(sourceFileName.replace(/\.md$/i, "")).slice(0, 30).join("");
        const backupName = (index: number) => `${stem} (conflict ${stamp}-${index}).md`;
        let backupPath = "";
        if (saveAsTitle !== undefined) {
          if (!(await fileIpc.saveDraftAs(backupName(1), backupContent, saveAsTitle, existingFileMessage))) return null;
        } else {
          if (!note) throw new Error("The conflicted note is no longer available");
          for (let index = 1; !backupPath; index++) {
            const candidate = `${directory}${backupName(index)}`;
            try {
              await fileIpc.create(candidate, backupContent);
              backupPath = candidate;
            } catch (error) {
              if (!(await fileIpc.exists(candidate))) throw error;
            }
          }
        }
        // Never write the external file. Re-read after the backup is durable.
        let originalMissing = false;
        let originalReadFailed = false;
        let restoredContent: string | undefined;
        try {
          restoredContent = (await fileIpc.read(filePath)).content;
        } catch (error) {
          originalMissing = (error as { code?: string })?.code === "FILE_NOT_FOUND";
          originalReadFailed = !originalMissing;
          if (originalReadFailed && note) {
            // Keep the tab on its last known baseline so selecting another note cannot save the recovered draft back.
            restoredContent = conflict.diskContent ?? getLastSavedContent(note.id) ?? note.content;
          }
        }
        const fileName = backupPath.split(/[\\/]/).pop() ?? "";
        const backup =
          note && backupPath
            ? {
                ...note,
                id: `${note.id.slice(0, note.id.lastIndexOf("/") + 1)}${fileName}`,
                filePath: backupPath,
                fileName,
                title: fileName.replace(/\.md$/i, ""),
                content: backupContent,
                github: undefined,
                isPinned: false
              }
            : null;
        clearPendingSave(conflict.noteId, filePath);
        if (backup) setLastSavedContent(backup.id, backupContent);
        if (note && restoredContent !== undefined) setLastSavedContent(note.id, restoredContent);
        set((state) => {
          const source = state.notes.find((item) => item.id === conflict.noteId && item.filePath === filePath);
          if (source && restoredContent !== undefined) {
            source.content = restoredContent;
            source.github = parseGitHubMetadata(restoredContent);
            if (state.selectedNoteId === source.id) state.editorContent = restoredContent;
          } else if (source && originalMissing) {
            state.notes = state.notes.filter((item) => item.id !== source.id);
            state.openNoteIds = state.openNoteIds.filter((id) => id !== source.id);
            state.playingNoteIds = state.playingNoteIds.filter((id) => id !== source.id);
          }
          if (backup && !state.notes.some((item) => item.filePath === backupPath)) state.notes.push(backup);
          if (originalMissing && source && state.selectedNoteId === source.id) {
            state.selectedNoteId = backup?.id ?? null;
            state.editorContent = backup?.content ?? "";
            if (backup && !state.openNoteIds.includes(backup.id)) state.openNoteIds.push(backup.id);
          }
        });
        clearSaveConflict(filePath);
        return { originalReadFailed };
      } finally {
        release();
      }
    }
  };
}
