import { useEffect, useRef, useState } from "react";
import { Note } from "@/types";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useExportLayoutStore, useExportThemeStore } from "@/stores";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { exportIpc } from "@/ipc/export";
import { buildClipboardDocument, buildWechatClipboardDocument } from "../lib/export-pipeline";
import {
  exportNoteAsHTML,
  exportNoteAsPDF,
  exportNoteAsPDFPages,
  exportNoteAsImage,
  exportNoteAsImagePages
} from "../lib";

export type ExportFormat = "html" | "pdf" | "pdf-pages" | "image" | "image-pages";

export interface UseNoteExportReturn {
  isExporting: boolean;
  exportNote: (note: Note, format: ExportFormat) => Promise<void>;
  copyFullText: (note: Note) => Promise<void>;
  copyToWechat: (note: Note) => Promise<void>;
}

function getCopyWorkspace() {
  const { workspacePath, revision, isLoading } = useWorkspaceStore.getState();
  if (!workspacePath || isLoading) return;
  const isCurrent = () => {
    const current = useWorkspaceStore.getState();
    return !current.isLoading && current.workspacePath === workspacePath && current.revision === revision;
  };
  return {
    workspacePath,
    isCurrent,
    assertCurrent() {
      if (!isCurrent()) throw new Error("USER_CANCELLED");
    }
  };
}

/**
 * 笔记导出 Hook
 * 封装所有导出相关的逻辑
 */
export function useNoteExport(): UseNoteExportReturn {
  const { t } = useTranslation("note");
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [isExporting, setIsExporting] = useState(false);
  const exportInFlight = useRef(false);
  const copyInFlight = useRef(false);
  const supersededCopyId = useRef(0);
  const clipboardConfirmation = useRef<{ requestId: number; finish: (confirmed: boolean) => void } | undefined>(
    undefined
  );

  useEffect(() => {
    const unsubscribeWorkspace = useWorkspaceStore.subscribe((current, previous) => {
      if (current.revision !== previous.revision) clipboardConfirmation.current?.finish(false);
    });
    const unsubscribeClipboard = exportIpc.onClipboardCopySuperseded((requestId) => {
      supersededCopyId.current = Math.max(supersededCopyId.current, requestId);
      const pending = clipboardConfirmation.current;
      if (pending && pending.requestId <= supersededCopyId.current) pending.finish(false);
    });
    return () => {
      unsubscribeWorkspace();
      unsubscribeClipboard();
      clipboardConfirmation.current?.finish(false);
    };
  }, []);

  const confirmPreparedClipboardCopy = async (requestId: number, isCurrent: () => boolean) => {
    if (requestId <= supersededCopyId.current) throw new Error("USER_CANCELLED");
    const confirmed =
      isCurrent() &&
      (await new Promise<boolean>((resolve) => {
        clipboardConfirmation.current?.finish(false);
        const finish = (choice: boolean) => {
          if (clipboardConfirmation.current?.finish !== finish) return;
          clipboardConfirmation.current = undefined;
          toast.dismiss(toastId);
          resolve(choice);
        };
        clipboardConfirmation.current = { requestId, finish };
        const toastId = toast.message(t("export.clipboardReady"), {
          description: t("export.clipboardReplace"),
          duration: Infinity,
          action: { label: t("export.clipboardCopyNow"), onClick: () => finish(true) },
          cancel: { label: t("export.clipboardCancel"), onClick: () => finish(false) },
          onDismiss: () => finish(false)
        });
      }));
    if (requestId <= supersededCopyId.current) throw new Error("USER_CANCELLED");
    const shouldWrite = confirmed && isCurrent();
    await exportIpc.confirmClipboardCopy(requestId, shouldWrite);
    if (!shouldWrite) throw new Error("USER_CANCELLED");
  };

  /**
   * 导出笔记
   */
  const exportNote = async (note: Note, format: ExportFormat) => {
    // 防止重复导出
    if (exportInFlight.current) {
      toast.info(t("export.exportingWait"));
      return;
    }

    exportInFlight.current = true;
    setIsExporting(true);
    toast.loading(t("export.exporting"), { id: "exporting" });

    try {
      switch (format) {
        case "html":
          await exportNoteAsHTML(note, exportThemeId, exportLayout);
          break;
        case "pdf":
          await exportNoteAsPDF(note, exportThemeId, exportLayout);
          break;
        case "pdf-pages":
          await exportNoteAsPDFPages(note, exportThemeId, exportLayout);
          break;
        case "image":
          await exportNoteAsImage(note, exportThemeId, exportLayout);
          break;
        case "image-pages":
          await exportNoteAsImagePages(note, exportThemeId, exportLayout);
          break;
      }

      toast.success(t("export.success"), { id: "exporting" });
    } catch (error) {
      // 用户取消导出，不显示错误
      if (error instanceof Error && error.message === "USER_CANCELLED") {
        toast.dismiss("exporting");
        return;
      }
      toast.error(t("export.failed"), {
        id: "exporting",
        description: error instanceof Error ? error.message : undefined
      });
    } finally {
      exportInFlight.current = false;
      setIsExporting(false);
    }
  };

  const copyFullText = async (note: Note) => {
    const workspace = getCopyWorkspace();
    if (copyInFlight.current || !workspace) return;
    clipboardConfirmation.current?.finish(false);
    copyInFlight.current = true;
    let toastId: string | number | undefined = toast.loading(t("export.copyFullTextPreparing"));
    try {
      const requestId = await exportIpc.beginClipboardCopy(workspace.workspacePath, note.filePath);
      workspace.assertCurrent();
      const html = await buildClipboardDocument(note, exportThemeId, exportLayout);
      workspace.assertCurrent();
      if ((await exportIpc.copyFullText(requestId, note.content, html)) === "confirmation-required") {
        toast.dismiss(toastId);
        toastId = undefined;
        await confirmPreparedClipboardCopy(requestId, workspace.isCurrent);
      }
      toast.success(t("export.copyFullTextSuccess", { title: note.title }), { id: toastId });
    } catch (error) {
      if (error instanceof Error && error.message === "USER_CANCELLED") {
        if (toastId !== undefined) toast.dismiss(toastId);
      } else {
        toast.error(t("export.copyFullTextFailed"), {
          id: toastId,
          description: error instanceof Error ? error.message : undefined
        });
      }
    } finally {
      copyInFlight.current = false;
    }
  };

  /** 复制笔记到微信公众号 */
  const copyToWechat = async (note: Note) => {
    const workspace = getCopyWorkspace();
    if (!workspace) return;
    clipboardConfirmation.current?.finish(false);
    try {
      const requestId = await exportIpc.beginClipboardCopy(workspace.workspacePath, note.filePath);
      workspace.assertCurrent();
      const html = await buildWechatClipboardDocument(note, exportThemeId, exportLayout);
      workspace.assertCurrent();
      if ((await exportIpc.copyHTMLToClipboard(requestId, html)) === "confirmation-required") {
        await confirmPreparedClipboardCopy(requestId, workspace.isCurrent);
      }
      toast.success(t("export.wechatSuccess"));
    } catch (error) {
      if (!(error instanceof Error && error.message === "USER_CANCELLED")) toast.error(t("export.wechatFailed"));
    }
  };

  return {
    isExporting,
    exportNote,
    copyFullText,
    copyToWechat
  };
}
