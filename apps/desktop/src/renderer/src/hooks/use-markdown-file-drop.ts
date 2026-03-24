import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { utilsIpc } from "@/ipc";
import { useWorkspaceStore } from "@/stores";

interface UseMarkdownFileDropOptions {
  onDropMarkdownFiles: (sourcePaths: string[]) => Promise<void> | void;
  onHoverChange?: (hovering: boolean) => void;
  ignoreWorkspaceFiles?: boolean;
}

export function useMarkdownFileDrop({
  onDropMarkdownFiles,
  onHoverChange,
  ignoreWorkspaceFiles = false
}: UseMarkdownFileDropOptions) {
  const { t } = useTranslation("note");
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const [isFileDropHover, setIsFileDropHover] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const fileDragDepthRef = useRef(0);

  const isFileDragEvent = useCallback((event: DragEvent): boolean => {
    return event.dataTransfer?.types?.includes("Files") ?? false;
  }, []);

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isFileDragEvent(event.nativeEvent)) return;
      event.preventDefault();
      fileDragDepthRef.current += 1;
      setIsFileDropHover(true);
    },
    [isFileDragEvent]
  );

  const handleDragOver = useCallback(
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

  const handleDragLeave = useCallback((_event: React.DragEvent<HTMLDivElement>) => {
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) {
      setIsFileDropHover(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      fileDragDepthRef.current = 0;
      setIsFileDropHover(false);
      if (isDropping) return;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const markdownPaths = Array.from(files)
        .filter((file) => file.name.toLowerCase().endsWith(".md"))
        .map((file) => utilsIpc.getPathForFile(file))
        .filter((filePath) => !!filePath);

      if (markdownPaths.length === 0) {
        toast.error(t("externalDrop.onlyMarkdown"));
        return;
      }

      const workspacePrefix = workspacePath ? `${workspacePath.replaceAll("\\", "/")}/` : null;
      const droppedMarkdownPaths = ignoreWorkspaceFiles
        ? markdownPaths.filter((filePath) => {
            if (!workspacePrefix) return true;
            const normalizedPath = filePath.replaceAll("\\", "/");
            return !normalizedPath.startsWith(workspacePrefix);
          })
        : markdownPaths;

      if (droppedMarkdownPaths.length === 0) {
        return;
      }

      setIsDropping(true);
      try {
        await onDropMarkdownFiles(droppedMarkdownPaths);
      } catch {
        toast.error(t("externalDrop.dropFailed"));
      } finally {
        setIsDropping(false);
      }
    },
    [ignoreWorkspaceFiles, isDropping, onDropMarkdownFiles, t, workspacePath]
  );

  useEffect(() => {
    onHoverChange?.(isFileDropHover);
  }, [isFileDropHover, onHoverChange]);

  useEffect(() => {
    return () => onHoverChange?.(false);
  }, [onHoverChange]);

  return {
    isFileDropHover,
    isDropping,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  };
}
