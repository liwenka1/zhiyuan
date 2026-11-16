import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useNoteStore } from "@/stores/note-store";
import { flushAllDebouncedSaves } from "@/stores/note-store/persistence";

/** 注册在 App 层，欢迎页和工作区都能响应主进程的关闭握手。 */
export function useWindowClose(): void {
  const { t } = useTranslation("note");

  useEffect(() => {
    const handlePrepareClose = async (closeAttempt: number) => {
      try {
        const { selectedNoteId, editorContent } = useNoteStore.getState();
        if (selectedNoteId && editorContent !== undefined) {
          await useNoteStore.getState().saveNoteToFileSystem(selectedNoteId, editorContent);
        }
        await flushAllDebouncedSaves(useNoteStore.getState);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`${t("errors.saveNoteFailed")}: ${message}`);
        return;
      }
      await window.api.window.readyToClose(closeAttempt).catch(() => {});
    };

    return window.api.window.onPrepareClose((closeAttempt) => {
      void handlePrepareClose(closeAttempt);
    });
  }, [t]);
}
