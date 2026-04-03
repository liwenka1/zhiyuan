import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMarkdownFileDrop } from "./use-markdown-file-drop";

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  importedPaths?: string[];
  importedNoteIds?: string[];
};

const noopDragHandlers: ReturnType<typeof useMarkdownFileDrop>["dragHandlers"] = {
  onDragEnter: () => {},
  onDragOver: () => {},
  onDragLeave: () => {},
  onDrop: async () => {}
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
  const hasImportHandler = typeof onImportExternalMarkdownFiles === "function";
  const { isFileDropHover, isDropping, dragHandlers } = useMarkdownFileDrop({
    onDropMarkdownFiles: async (sourcePaths) => {
      if (!onImportExternalMarkdownFiles) return;

      const result = await onImportExternalMarkdownFiles(sourcePaths);
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
        return;
      }

      throw new Error("No markdown files imported");
    },
    onHoverChange: hasImportHandler ? onHoverChange : undefined,
    ignoreWorkspaceFiles: true
  });

  return {
    isFileDropHover: hasImportHandler ? isFileDropHover : false,
    isImportingExternal: hasImportHandler ? isDropping : false,
    dragHandlers: hasImportHandler ? dragHandlers : noopDragHandlers
  };
}
