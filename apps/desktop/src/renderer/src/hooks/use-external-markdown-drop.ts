import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { utilsIpc } from "@/ipc";
import { useWorkspaceStore } from "@/stores";

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  importedPaths?: string[];
  importedNoteIds?: string[];
};

interface UseExternalMarkdownDropOptions {
  onImportExternalMarkdownFiles?: (sourcePaths: string[]) => Promise<ImportResult>;
  onHoverChange?: (hovering: boolean) => void;
  onImportCompleted?: (result: ImportResult) => void;
}

export function useExternalMarkdownDrop({
  onImportExternalMarkdownFiles,
  onHoverChange,
  onImportCompleted
}: UseExternalMarkdownDropOptions) {
  const { t } = useTranslation("note");
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const [isFileDropHover, setIsFileDropHover] = useState(false);
  const [isImportingExternal, setIsImportingExternal] = useState(false);
  const fileDragDepthRef = useRef(0);

  const isFileDragEvent = useCallback((event: DragEvent): boolean => {
    return event.dataTransfer?.types?.includes("Files") ?? false;
  }, []);

  const handleExternalDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isFileDragEvent(event.nativeEvent)) return;
      event.preventDefault();
      fileDragDepthRef.current += 1;
      setIsFileDropHover(true);
    },
    [isFileDragEvent]
  );

  const handleExternalDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isFileDragEvent(event.nativeEvent)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isFileDropHover) {
        setIsFileDropHover(true);
      }
    },
    [isFileDragEvent, isFileDropHover]
  );

  const handleExternalDragLeave = useCallback((_event: React.DragEvent<HTMLDivElement>) => {
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) {
      setIsFileDropHover(false);
    }
  }, []);

  const handleExternalDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      fileDragDepthRef.current = 0;
      setIsFileDropHover(false);
      if (isImportingExternal || !onImportExternalMarkdownFiles) return;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const markdownPaths = Array.from(files)
        .filter((file) => file.name.toLowerCase().endsWith(".md"))
        .map((file) => utilsIpc.getPathForFile(file))
        .filter((filePath) => !!filePath);

      const workspacePrefix = workspacePath ? `${workspacePath.replaceAll("\\", "/")}/` : null;
      const externalMarkdownPaths = markdownPaths.filter((filePath) => {
        if (!workspacePrefix) return true;
        const normalizedPath = filePath.replaceAll("\\", "/");
        return !normalizedPath.startsWith(workspacePrefix);
      });

      // Ignore files dragged back from current workspace (e.g. copy-out then drag-in).
      if (externalMarkdownPaths.length === 0) {
        return;
      }

      if (markdownPaths.length === 0) {
        toast.error(t("externalDrop.onlyMarkdown"));
        return;
      }

      setIsImportingExternal(true);
      try {
        const result = await onImportExternalMarkdownFiles(externalMarkdownPaths);
        if (result.importedCount > 0) {
          toast.success(
            result.skippedCount > 0
              ? t("externalDrop.importSuccessWithSkipped", {
                  importedCount: result.importedCount,
                  skippedCount: result.skippedCount
                })
              : t("externalDrop.importSuccess", { count: result.importedCount })
          );
          onImportCompleted?.(result);
        } else {
          toast.error(t("externalDrop.importFailed"));
        }
      } catch {
        toast.error(t("externalDrop.importFailed"));
      } finally {
        setIsImportingExternal(false);
      }
    },
    [isImportingExternal, onImportExternalMarkdownFiles, onImportCompleted, t, workspacePath]
  );

  useEffect(() => {
    onHoverChange?.(isFileDropHover);
  }, [isFileDropHover, onHoverChange]);

  useEffect(() => {
    return () => onHoverChange?.(false);
  }, [onHoverChange]);

  return {
    isFileDropHover,
    isImportingExternal,
    dragHandlers: {
      onDragEnter: handleExternalDragEnter,
      onDragOver: handleExternalDragOver,
      onDragLeave: handleExternalDragLeave,
      onDrop: handleExternalDrop
    }
  };
}
