import type { NoteStoreGet, NoteStoreSet } from "./types";
import { MAX_OPEN_NOTES } from "./constants";
import type { Note } from "@/types";
import { formatMarkdown } from "@/lib/formatter";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import { fileIpc, configIpc, watcherIpc } from "@/ipc";
import { clearDebouncedSave, setLastSavedContent } from "./persistence";
import { isValidFileNameSegment } from "@shared";

export function createNoteActions(set: NoteStoreSet, get: NoteStoreGet) {
  return {
    setNotes: (notes: Note[]) =>
      set((state) => {
        state.notes = notes;
        state.openNoteIds = state.openNoteIds.filter((id) => notes.some((note) => note.id === id));
      }),

    selectNote: (noteId: string) => {
      const { selectedNoteId, editorContent } = get();

      if (selectedNoteId) {
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

    createNote: async (folderId?: string, customTitle?: string) => {
      const workspacePath = useWorkspaceStore.getState().workspacePath;

      if (!workspacePath) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      try {
        const targetFolderId = folderId || useFolderStore.getState().selectedFolderId || null;

        let title: string;
        if (customTitle) {
          // 使用用户提供的标题
          title = customTitle.trim();
          if (!isValidFileNameSegment(title)) {
            toast.error(i18n.t("note:errors.invalidName"));
            return;
          }
        } else {
          // 自动生成默认标题
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
          title = `${defaultTitle} ${nextNumber}`;
        }
        const fileName = `${title}.md`;
        const content = `# ${title}\n\n${i18n.t("note:defaultContent")}`;

        let filePath: string;
        const pathSeparator = workspacePath.includes("\\") ? "\\" : "/";
        if (targetFolderId) {
          const folder = useFolderStore.getState().folders.find((f) => f.id === targetFolderId);
          if (folder?.path) {
            filePath = `${folder.path}${pathSeparator}${fileName}`;
          } else {
            filePath = `${workspacePath}${pathSeparator}${targetFolderId}${pathSeparator}${fileName}`;
          }
        } else {
          filePath = `${workspacePath}${pathSeparator}${fileName}`;
        }

        await watcherIpc.pause();
        try {
          await fileIpc.create(filePath, content);
        } finally {
          await watcherIpc.resume();
        }

        const newNote: Note = {
          id: filePath.replace(`${workspacePath}${pathSeparator}`, "").replaceAll("\\", "/"),
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
        setLastSavedContent(newNote.id, newNote.content);
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
        if (!isValidFileNameSegment(newTitle)) {
          toast.error(i18n.t("note:errors.invalidName"));
          return;
        }
        const separator = note.filePath.includes("\\") ? "\\" : "/";
        const pathParts = note.filePath.split(/[\\/]/);
        const oldFileName = pathParts[pathParts.length - 1];
        const newFileName = `${newTitle}.md`;
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join(separator);

        if (get().selectedNoteId === noteId) {
          clearDebouncedSave(noteId);
          await get().saveNoteToFileSystem(noteId, get().editorContent);
        }

        await watcherIpc.pause();

        await fileIpc.rename(note.filePath, newFilePath);

        const newNoteId = note.id.endsWith(oldFileName)
          ? `${note.id.slice(0, -oldFileName.length)}${newFileName}`
          : newFileName;
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

          const playingIndex = state.playingNoteIds.indexOf(noteId);
          if (playingIndex !== -1) {
            state.playingNoteIds[playingIndex] = newNoteId;
          }

          if (state.selectedNoteId === noteId) {
            state.selectedNoteId = newNoteId;
          }

          if (state.savingNoteIds.has(noteId)) {
            state.savingNoteIds.delete(noteId);
            state.savingNoteIds.add(newNoteId);
          }
        });

        const renamedNote = get().notes.find((item) => item.id === newNoteId);
        if (renamedNote) setLastSavedContent(newNoteId, renamedNote.content);

        const allPinnedNotes = get()
          .notes.filter((n) => n.isPinned)
          .map((n) => n.id);
        await configIpc.setPinnedNotes(workspacePath, allPinnedNotes);
      } catch (error) {
        toast.error(i18n.t("note:errors.renameNoteFailed"));
        throw error;
      } finally {
        await watcherIpc.resume();
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

        if (get().selectedNoteId === noteId) {
          clearDebouncedSave(noteId);
          await get().saveNoteToFileSystem(noteId, get().editorContent);
        }

        const separator = note.filePath.includes("\\") ? "\\" : "/";
        const pathParts = note.filePath.split(/[\\/]/);
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join(separator);

        const newNoteId = note.id.endsWith(note.fileName)
          ? `${note.id.slice(0, -note.fileName.length)}${newFileName}`
          : newFileName;
        const newNote: Note = {
          ...note,
          id: newNoteId,
          title: newTitle,
          fileName: newFileName,
          filePath: newFilePath,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await watcherIpc.pause();
        try {
          await fileIpc.copy(note.filePath, newFilePath);
          set((state) => {
            state.notes.push(newNote);
          });
          setLastSavedContent(newNote.id, newNote.content);
        } finally {
          await watcherIpc.resume();
        }
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
    },

    moveNote: async (noteId: string, targetFolderId: string, options) => {
      const silent = options?.silent ?? false;
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);
      const folders = useFolderStore.getState().folders;
      const targetFolder = folders.find((f) => f.id === targetFolderId);

      if (!workspacePath || !note?.filePath || !note.fileName) {
        if (!silent) toast.error(i18n.t("note:errors.noWorkspace"));
        return { moved: false, reason: "no-workspace" as const };
      }
      if (!targetFolder?.path) {
        if (!silent) toast.error(i18n.t("note:errors.moveNoteFailed"));
        return { moved: false, reason: "invalid-target" as const };
      }
      if (note.folderId === targetFolderId) {
        return { moved: false, reason: "same-folder" as const };
      }

      const parsedName = /^(.+?)(\.[^.]+)?$/.exec(note.fileName);
      const baseName = parsedName?.[1] ?? note.fileName;
      const extension = parsedName?.[2] ?? ".md";
      let resolvedFileName = `${baseName}${extension}`;
      const pathSeparator = targetFolder.path.includes("\\") ? "\\" : "/";
      let resolvedFilePath = `${targetFolder.path}${pathSeparator}${resolvedFileName}`;
      let renamed = false;

      try {
        if (get().selectedNoteId === noteId) {
          clearDebouncedSave(noteId);
          await get().saveNoteToFileSystem(noteId, get().editorContent);
        }
        await watcherIpc.pause();
        let index = 1;
        while (await fileIpc.exists(resolvedFilePath)) {
          renamed = true;
          resolvedFileName = `${baseName} (${index})${extension}`;
          resolvedFilePath = `${targetFolder.path}${pathSeparator}${resolvedFileName}`;
          index += 1;
        }
        await fileIpc.rename(note.filePath, resolvedFilePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!silent) {
          toast.error(
            message ? `${i18n.t("note:errors.moveNoteFailed")}: ${message}` : i18n.t("note:errors.moveNoteFailed")
          );
        }
        return { moved: false, reason: "failed" as const, errorMessage: message || undefined };
      } finally {
        await watcherIpc.resume();
      }

      const newNoteId = targetFolderId + "/" + resolvedFileName;
      set((state) => {
        const targetNote = state.notes.find((n) => n.id === noteId);
        if (targetNote) {
          targetNote.id = newNoteId;
          targetNote.filePath = resolvedFilePath;
          targetNote.fileName = resolvedFileName;
          targetNote.title = resolvedFileName.replace(/\.md$/i, "");
          targetNote.folderId = targetFolderId;
          targetNote.updatedAt = new Date().toISOString();
        }
        const openIndex = state.openNoteIds.indexOf(noteId);
        if (openIndex !== -1) {
          state.openNoteIds[openIndex] = newNoteId;
        }
        const playingIndex = state.playingNoteIds.indexOf(noteId);
        if (playingIndex !== -1) {
          state.playingNoteIds[playingIndex] = newNoteId;
        }
        if (state.selectedNoteId === noteId) {
          state.selectedNoteId = newNoteId;
        }
      });

      const movedNote = get().notes.find((item) => item.id === newNoteId);
      if (movedNote) setLastSavedContent(newNoteId, movedNote.content);

      const folderStore = useFolderStore.getState();
      folderStore.setFolders(
        folderStore.folders.map((f) =>
          f.id === targetFolderId
            ? { ...f, noteCount: (f.noteCount ?? 0) + 1 }
            : f.id === note.folderId
              ? { ...f, noteCount: Math.max(0, (f.noteCount ?? 0) - 1) }
              : f
        )
      );
      if (!silent) {
        toast.success(renamed ? i18n.t("note:moveNoteRenamedSuccess") : i18n.t("note:moveNoteSuccess"));
      }
      return { moved: true, renamed };
    }
  };
}
