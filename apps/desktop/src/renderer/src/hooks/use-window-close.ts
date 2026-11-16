import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNoteStore } from "@/stores/note-store";
import { flushAllDebouncedSaves, getLastSavedContent } from "@/stores/note-store/persistence";
import { beginCloseRequest, waitForFileOperations, waitForBackgroundSaves } from "@/stores/note-store/operation-guard";

/** 注册在 App 层，欢迎页和工作区都能响应主进程的关闭握手。 */
export function useWindowClose(): void {
  const { t } = useTranslation("note");

  useEffect(() => {
    const handlePrepareClose = async (closeAttempt: number) => {
      const release = beginCloseRequest();
      try {
        await waitForBackgroundSaves();
        await waitForFileOperations();
        const { selectedNoteId, editorContent, notes } = useNoteStore.getState();
        const selectedNote = notes?.find((note) => note.id === selectedNoteId);
        if (
          selectedNoteId &&
          editorContent !== undefined &&
          (!selectedNote || editorContent !== getLastSavedContent(selectedNoteId))
        ) {
          await useNoteStore.getState().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
        await flushAllDebouncedSaves(useNoteStore.getState);
        await window.api.window.readyToClose(closeAttempt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`${t("errors.saveNoteFailed")}: ${message}`);
      } finally {
        release();
      }
    };

    return window.api.window.onPrepareClose((closeAttempt) => {
      void handlePrepareClose(closeAttempt);
    });
  }, [t]);
}
