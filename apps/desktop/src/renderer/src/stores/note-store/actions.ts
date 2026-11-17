import type { NoteStoreGet, NoteStoreSet } from "./types";
import { MAX_OPEN_NOTES } from "./constants";
import type { Note } from "@/types";
import { formatMarkdown } from "@/lib/formatter";
import i18n from "@/lib/i18n";
import { toast } from "sonner";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import { fileIpc, configIpc, watcherIpc } from "@/ipc";
import {
  clearDebouncedSave,
  clearPendingSave,
  getLastSavedContent,
  hasPendingSave,
  setLastSavedContent
} from "./persistence";
import { isValidWorkspaceEntryName } from "@shared";
import { beginFileOperation, isEditingBlocked, isPublishingPath } from "./operation-guard";
import { parseGitHubMetadata, stripGitHubMetadata } from "@/lib/github-metadata";
import { saveNoteBeforePathChange } from "./path-change-persistence";

export function createNoteActions(set: NoteStoreSet, get: NoteStoreGet) {
  const beginNotePathOperation = (workspacePath: string, filePath: string) => {
    const release = beginFileOperation({ workspacePath, path: filePath });
    if (!release && isPublishingPath(workspacePath, filePath)) {
      toast.error(i18n.t("note:github.publishInProgress"));
    }
    return release;
  };
  const isCurrentWorkspaceReady = (workspacePath: string | null) => {
    const current = useWorkspaceStore.getState();
    return !current.isLoading && current.workspacePath === workspacePath;
  };
  const reloadNoteContent = async (noteId: string, filePath: string, workspacePath: string) => {
    const { content } = await fileIpc.read(filePath);
    if (!isCurrentWorkspaceReady(workspacePath)) return;
    const note = get().notes.find((item) => item.id === noteId && item.filePath === filePath);
    if (!note) return;
    set((state) => {
      const target = state.notes.find((item) => item.id === noteId && item.filePath === filePath);
      if (!target) return;
      target.content = content;
      target.github = parseGitHubMetadata(content);
      if (state.selectedNoteId === noteId) state.editorContent = content;
    });
    setLastSavedContent(noteId, content);
    return content;
  };
  return {
    setNotes: (notes: Note[]) =>
      set((state) => {
        state.notes = notes;
        state.openNoteIds = state.openNoteIds.filter((id) => notes.some((note) => note.id === id));
      }),

    selectNote: (noteId: string) => {
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const { selectedNoteId, editorContent } = get();

      if (selectedNoteId) {
        const currentNote = get().notes.find((n) => n.id === selectedNoteId);
        if (
          currentNote?.filePath &&
          (hasPendingSave(currentNote.filePath) ||
            editorContent !== (getLastSavedContent(selectedNoteId) ?? currentNote.content))
        ) {
          clearDebouncedSave(selectedNoteId);
          void get()
            .saveNoteToFileSystem(selectedNoteId, editorContent)
            .catch(() => {});
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
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
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
          if (!isValidWorkspaceEntryName(title)) {
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

        await watcherIpc.pause(workspacePath);
        try {
          if (!isCurrentWorkspaceReady(workspacePath)) return;
          await fileIpc.create(filePath, content);
        } finally {
          await watcherIpc.resume(workspacePath);
        }
        if (!isCurrentWorkspaceReady(workspacePath)) return;

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
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const { selectedNoteId, editorContent } = get();
      if (!selectedNoteId) return;
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((item) => item.id === selectedNoteId);
      if (!note) return;
      const originalFilePath = note.filePath;
      const originalContent = note.content;
      const originalUpdatedAt = note.updatedAt;

      try {
        const formattedContent = await formatMarkdown(editorContent);
        const current = get();
        const currentNote = current.notes.find((item) => item.id === selectedNoteId);
        if (
          !isCurrentWorkspaceReady(workspacePath) ||
          current.selectedNoteId !== selectedNoteId ||
          current.editorContent !== editorContent ||
          !currentNote ||
          currentNote.filePath !== originalFilePath ||
          currentNote.content !== originalContent ||
          currentNote.updatedAt !== originalUpdatedAt
        ) {
          return;
        }
        current.updateNoteContent(formattedContent);
      } catch {
        toast.error(i18n.t("note:errors.formatNoteFailed"));
      }
    },

    deleteNote: (noteId: string) => {
      clearPendingSave(noteId);
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
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note?.filePath) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      let didPause = false;
      let releaseOperation: (() => void) | null = null;
      try {
        const normalizedTitle = newTitle.trim();
        if (!isValidWorkspaceEntryName(normalizedTitle)) {
          toast.error(i18n.t("note:errors.invalidName"));
          return;
        }
        const separator = note.filePath.includes("\\") ? "\\" : "/";
        const pathParts = note.filePath.split(/[\\/]/);
        const oldFileName = pathParts[pathParts.length - 1];
        const newFileName = `${normalizedTitle}.md`;
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join(separator);

        releaseOperation = beginNotePathOperation(workspacePath, note.filePath);
        if (!releaseOperation) return;
        const savedContent = await saveNoteBeforePathChange(get, noteId);
        if (!isCurrentWorkspaceReady(workspacePath)) return;

        await watcherIpc.pause(workspacePath);
        didPause = true;
        if (!isCurrentWorkspaceReady(workspacePath)) return;

        await fileIpc.rename(note.filePath, newFilePath);
        if (!isCurrentWorkspaceReady(workspacePath)) return;

        const newNoteId = note.id.endsWith(oldFileName)
          ? `${note.id.slice(0, -oldFileName.length)}${newFileName}`
          : newFileName;
        set((state) => {
          const targetNote = state.notes.find((n) => n.id === noteId);
          if (targetNote) {
            targetNote.id = newNoteId;
            targetNote.title = normalizedTitle;
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

        if (savedContent !== undefined) setLastSavedContent(newNoteId, savedContent);

        const allPinnedNotes = get()
          .notes.filter((n) => n.isPinned)
          .map((n) => n.id);
        await configIpc.setPinnedNotes(workspacePath, allPinnedNotes);
        await reloadNoteContent(newNoteId, newFilePath, workspacePath);
      } catch (error) {
        toast.error(i18n.t("note:errors.renameNoteFailed"));
        throw error;
      } finally {
        try {
          if (didPause) await watcherIpc.resume(workspacePath);
        } finally {
          releaseOperation?.();
        }
      }
    },

    duplicateNote: async (noteId: string) => {
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note?.filePath || !note.fileName) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      const releaseOperation = beginNotePathOperation(workspacePath, note.filePath);
      if (!releaseOperation) return;
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

        await saveNoteBeforePathChange(get, noteId);
        if (!isCurrentWorkspaceReady(workspacePath)) return;
        const sourceContent = await reloadNoteContent(noteId, note.filePath, workspacePath);
        if (sourceContent === undefined || !isCurrentWorkspaceReady(workspacePath)) return;

        const separator = note.filePath.includes("\\") ? "\\" : "/";
        const pathParts = note.filePath.split(/[\\/]/);
        pathParts[pathParts.length - 1] = newFileName;
        const newFilePath = pathParts.join(separator);

        const newNoteId = note.id.endsWith(note.fileName)
          ? `${note.id.slice(0, -note.fileName.length)}${newFileName}`
          : newFileName;
        const content = stripGitHubMetadata(sourceContent);
        const newNote: Note = {
          ...note,
          content,
          id: newNoteId,
          title: newTitle,
          fileName: newFileName,
          filePath: newFilePath,
          isPinned: false,
          github: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await watcherIpc.pause(workspacePath);
        try {
          if (!isCurrentWorkspaceReady(workspacePath)) return;
          await fileIpc.create(newFilePath, content);
          if (!isCurrentWorkspaceReady(workspacePath)) return;
          set((state) => {
            state.notes.push(newNote);
          });
          setLastSavedContent(newNote.id, newNote.content);
        } finally {
          await watcherIpc.resume(workspacePath);
        }
      } catch (error) {
        toast.error(i18n.t("note:errors.duplicateNoteFailed"));
        throw error;
      } finally {
        releaseOperation();
      }
    },

    togglePinNote: async (noteId: string) => {
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked()) return;
      const workspacePath = useWorkspaceStore.getState().workspacePath;
      const note = get().notes.find((n) => n.id === noteId);

      if (!workspacePath || !note) {
        toast.error(i18n.t("note:errors.noWorkspace"));
        return;
      }

      const previousPinnedState = note.isPinned;
      try {
        const newPinnedState = !previousPinnedState;

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
        if (isCurrentWorkspaceReady(workspacePath)) {
          set((state) => {
            const targetNote = state.notes.find((n) => n.id === noteId);
            if (targetNote) targetNote.isPinned = previousPinnedState;
          });
        }
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
      if (useWorkspaceStore.getState().isLoading || isEditingBlocked())
        return { moved: false, reason: "no-workspace" as const };
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
      let didPause = false;

      const releaseOperation = beginNotePathOperation(workspacePath, note.filePath);
      if (!releaseOperation) return { moved: false, reason: "no-workspace" as const };
      try {
        const savedContent = await saveNoteBeforePathChange(get, noteId);
        if (!isCurrentWorkspaceReady(workspacePath)) return { moved: false, reason: "no-workspace" as const };
        await watcherIpc.pause(workspacePath);
        didPause = true;
        if (!isCurrentWorkspaceReady(workspacePath)) return { moved: false, reason: "no-workspace" as const };
        let index = 1;
        while (await fileIpc.exists(resolvedFilePath)) {
          if (!isCurrentWorkspaceReady(workspacePath)) return { moved: false, reason: "no-workspace" as const };
          renamed = true;
          resolvedFileName = `${baseName} (${index})${extension}`;
          resolvedFilePath = `${targetFolder.path}${pathSeparator}${resolvedFileName}`;
          index += 1;
        }
        if (!isCurrentWorkspaceReady(workspacePath)) return { moved: false, reason: "no-workspace" as const };
        await fileIpc.rename(note.filePath, resolvedFilePath);
        if (!isCurrentWorkspaceReady(workspacePath)) return { moved: false, reason: "no-workspace" as const };

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

        if (savedContent !== undefined) setLastSavedContent(newNoteId, savedContent);

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
        await configIpc.setPinnedNotes(
          workspacePath,
          get()
            .notes.filter((item) => item.isPinned)
            .map((item) => item.id)
        );
        await reloadNoteContent(newNoteId, resolvedFilePath, workspacePath);
        if (!silent) {
          toast.success(renamed ? i18n.t("note:moveNoteRenamedSuccess") : i18n.t("note:moveNoteSuccess"));
        }
        return { moved: true, renamed };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!silent) {
          toast.error(
            message ? `${i18n.t("note:errors.moveNoteFailed")}: ${message}` : i18n.t("note:errors.moveNoteFailed")
          );
        }
        return { moved: false, reason: "failed" as const, errorMessage: message || undefined };
      } finally {
        try {
          if (didPause) await watcherIpc.resume(workspacePath);
        } finally {
          releaseOperation();
        }
      }
    }
  };
}
