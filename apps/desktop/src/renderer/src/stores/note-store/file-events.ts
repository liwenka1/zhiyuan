import type { NoteStoreGet, NoteStoreSet } from "./types";
import { handleFileAdded, handleFileChanged } from "@/lib/file-watcher";
import { useWorkspaceStore } from "../use-workspace-store";
import { useFolderStore } from "../use-folder-store";
import {
  clearPendingSave,
  getLastSavedContent,
  hasPendingSave,
  isOwnSaveContent,
  recordSaveConflict,
  setLastSavedContent
} from "./persistence";
import { parseGitHubMetadata } from "@/lib/github-metadata";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

export function createFileEventHandlers(set: NoteStoreSet, get: NoteStoreGet) {
  const pendingFileReads = new Map<string, symbol>();
  const pendingFileAdds = new Map<string, { fullPath: string; revision: number; completion: Promise<void> }>();

  const handlers = {
    handleFileAddedEvent: async (filePath: string, fullPath: string) => {
      const { workspacePath, revision } = useWorkspaceStore.getState();
      if (!workspacePath) return;
      const currentNote = get().notes.find((note) => note.id === filePath && note.filePath === fullPath);
      if (currentNote) {
        await handlers.handleFileChangedEvent(filePath, fullPath);
        return;
      }

      const completion: Promise<void> = handleFileAdded(filePath, fullPath, get().notes)
        .then(async (newNote) => {
          const latest = pendingFileAdds.get(filePath);
          if (latest?.completion !== completion) {
            // An open request can be waiting for the newer read started by a watcher event.
            if (latest?.fullPath === fullPath && latest.revision === revision) await latest.completion;
            return;
          }
          const workspace = useWorkspaceStore.getState();
          if (
            !newNote ||
            workspace.revision !== revision ||
            workspace.workspacePath !== workspacePath ||
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
        })
        .finally(() => {
          if (pendingFileAdds.get(filePath)?.completion === completion) pendingFileAdds.delete(filePath);
        });
      pendingFileAdds.set(filePath, { fullPath, revision, completion });
      await completion;
    },

    handleFileDeletedEvent: (filePath: string) => {
      pendingFileReads.delete(filePath);
      pendingFileAdds.delete(filePath);
      const note = get().notes.find((n) => n.id === filePath);
      if (!note) return;

      const lastSavedContent = getLastSavedContent(filePath) ?? note.content;
      const displayedContent = get().selectedNoteId === filePath ? get().editorContent : note.content;
      if (
        (note.filePath && hasPendingSave(note.filePath)) ||
        note.content !== lastSavedContent ||
        displayedContent !== lastSavedContent
      ) {
        recordSaveConflict(note.id, note.filePath!, displayedContent, null);
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

      let baseline = getLastSavedContent(filePath) ?? note.content;

      const readToken = Symbol("file-change-read");
      pendingFileReads.set(filePath, readToken);
      try {
        for (;;) {
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
          const currentSavedContent = getLastSavedContent(filePath) ?? baseline;
          // Read again when another save completed during the read. The event may be an external write after that save.
          if (currentSavedContent !== baseline) {
            baseline = currentSavedContent;
            continue;
          }
          // Read before deciding: dirty notes can also receive their own save notifications.
          if (content === currentSavedContent || isOwnSaveContent(fullPath, content)) return;
          const currentDisplayedContent =
            current.selectedNoteId === filePath ? current.editorContent : currentNote.content;
          if (
            hasPendingSave(fullPath) ||
            currentNote.content !== currentSavedContent ||
            currentDisplayedContent !== currentSavedContent
          ) {
            recordSaveConflict(filePath, fullPath, currentDisplayedContent, content);
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
          return;
        }
      } finally {
        if (pendingFileReads.get(filePath) === readToken) {
          pendingFileReads.delete(filePath);
        }
      }
    }
  };
  return handlers;
}
