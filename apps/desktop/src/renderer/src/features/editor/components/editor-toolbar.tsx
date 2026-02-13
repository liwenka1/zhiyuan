import { useState } from "react";
import {
  Eye,
  Wand2,
  TableOfContents as TocIcon,
  Pin,
  PinOff,
  Presentation,
  Columns2,
  EllipsisVertical,
  FolderOpen,
  Pencil,
  Copy,
  Download,
  Trash2,
  ChevronRight,
  FileOutput
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TableOfContents } from "./table-of-contents";
import { useViewStore } from "@/stores";
import { useNoteStore } from "@/stores";
import { useTranslation } from "react-i18next";

interface EditorToolbarProps {
  content?: string;
  onShowNoteInExplorer?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onRenameNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onDuplicateNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
  onExportNote?: (
    note: { id: string; title: string; updatedAt?: string; isPinned?: boolean },
    format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages"
  ) => void;
  onDeleteNote?: (note: { id: string; title: string; updatedAt?: string; isPinned?: boolean }) => void;
}

export function EditorToolbar({
  content = "",
  onShowNoteInExplorer,
  onRenameNote,
  onDuplicateNote,
  onExportNote,
  onDeleteNote
}: EditorToolbarProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const isPresentationMode = useViewStore((state) => state.isPresentationMode);
  const setExclusiveMode = useViewStore((state) => state.setExclusiveMode);
  const exportPreview = useViewStore((state) => state.previewConfig.exportPreview);
  const formatCurrentNote = useNoteStore((state) => state.formatCurrentNote);
  const selectedNote = useNoteStore((state) => state.getSelectedNote());
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const { t } = useTranslation("editor");
  const [tocOpen, setTocOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const handleFormat = () => {
    formatCurrentNote();
  };

  const isPreviewMode = editorMode === "preview";
  const isSplitMode = editorMode === "split";
  const isEditMode = editorMode === "edit";
  const hasNote = !!selectedNoteId;
  const showPreview = isPreviewMode || isSplitMode; // 预览或分栏模式下都显示预览内容
  const noteSummary = selectedNote
    ? {
        id: selectedNote.id,
        title: selectedNote.title,
        updatedAt: selectedNote.updatedAt,
        isPinned: selectedNote.isPinned
      }
    : null;

  // 编辑模式下强制关闭目录（派生状态）
  const effectiveTocOpen = isEditMode ? false : tocOpen;
  const effectiveIsPinned = isEditMode ? false : isPinned;

  const handleShowInExplorer = () => {
    if (noteSummary) {
      onShowNoteInExplorer?.(noteSummary);
    }
  };

  const handleRenameNote = () => {
    if (noteSummary) {
      onRenameNote?.(noteSummary);
    }
  };

  const handleDuplicateNote = () => {
    if (noteSummary) {
      onDuplicateNote?.(noteSummary);
    }
  };

  const handleDeleteNote = () => {
    if (noteSummary) {
      onDeleteNote?.(noteSummary);
    }
  };

  const handleToggleExportPreview = (pressed: boolean) => {
    if (pressed) {
      setTocOpen(false);
    }
    setExclusiveMode(pressed ? "exportPreview" : "edit");
  };

  const handleTogglePreviewMode = (pressed: boolean) => {
    setExclusiveMode(pressed ? "preview" : "edit");
  };

  const handleToggleSplitMode = (pressed: boolean) => {
    setExclusiveMode(pressed ? "split" : "edit");
  };

  const handleTogglePresentationMode = (pressed: boolean) => {
    setExclusiveMode(pressed ? "presentation" : "edit");
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-end px-3">
      {/* 工具按钮 */}
      <div className="flex shrink-0 items-center gap-1">
        {/* 预览按钮 */}
        <Toggle
          size="icon-sm"
          className="data-[state=on]:bg-muted data-[state=on]:text-foreground"
          aria-label={t("toolbar.preview")}
          pressed={editorMode === "preview" && !exportPreview && !isPresentationMode}
          onPressedChange={handleTogglePreviewMode}
          disabled={!hasNote || isPresentationMode}
        >
          <Eye className="h-4 w-4" />
        </Toggle>

        {/* 分栏按钮 */}
        <Toggle
          size="icon-sm"
          className="data-[state=on]:bg-muted data-[state=on]:text-foreground"
          aria-label={t("toolbar.split")}
          pressed={editorMode === "split" && !isPresentationMode}
          onPressedChange={handleToggleSplitMode}
          disabled={!hasNote || isPresentationMode}
        >
          <Columns2 className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="icon-sm"
          className="data-[state=on]:bg-muted data-[state=on]:text-foreground"
          aria-label={t("toolbar.exportPreview")}
          pressed={exportPreview && !isPresentationMode}
          onPressedChange={handleToggleExportPreview}
          disabled={!hasNote || isPresentationMode}
        >
          <FileOutput className="h-4 w-4" />
        </Toggle>

        {/* 演示按钮 */}
        <Toggle
          size="icon-sm"
          className="data-[state=on]:bg-muted data-[state=on]:text-foreground"
          aria-label={t("toolbar.presentation")}
          pressed={isPresentationMode}
          onPressedChange={handleTogglePresentationMode}
          disabled={!hasNote}
        >
          <Presentation className="h-4 w-4" />
        </Toggle>

        {/* 格式化按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t("toolbar.format")}
          onClick={handleFormat}
          disabled={!hasNote || editorMode === "preview"}
        >
          <Wand2 className="h-4 w-4" />
        </Button>

        {/* 目录按钮 */}
        <Popover open={effectiveTocOpen} onOpenChange={setTocOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={t("toolbar.toc")}
              disabled={!hasNote || !showPreview || exportPreview}
            >
              <TocIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80"
            onInteractOutside={(e) => {
              // 如果已固定，阻止点击外部关闭
              if (effectiveIsPinned) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e) => {
              // 如果已固定，阻止 ESC 键关闭
              if (effectiveIsPinned) {
                e.preventDefault();
              }
            }}
          >
            <div className="space-y-2">
              {/* 头部：标题 + 固定按钮 */}
              <div className="flex items-center justify-between">
                <h4 className="leading-none font-medium">{t("toolbar.toc")}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setIsPinned(!effectiveIsPinned)}
                  aria-label={effectiveIsPinned ? t("toc.unpin") : t("toc.pin")}
                >
                  {effectiveIsPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
              </div>
              <TableOfContents content={content} noteId={selectedNoteId ?? undefined} />
            </div>
          </PopoverContent>
        </Popover>

        {/* 更多操作 */}
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label={t("toolbar.more")}
              disabled={!hasNote}
            >
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2"
                onClick={handleShowInExplorer}
              >
                <FolderOpen className="h-4 w-4" />
                <span>{t("toolbar.showInExplorer")}</span>
              </Button>
              <div className="bg-border my-1 h-px" />
              <Button variant="ghost" size="sm" className="h-8 w-full justify-start gap-2" onClick={handleRenameNote}>
                <Pencil className="h-4 w-4" />
                <span>{t("toolbar.rename")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2"
                onClick={handleDuplicateNote}
              >
                <Copy className="h-4 w-4" />
                <span>{t("toolbar.duplicate")}</span>
              </Button>
              <div className="bg-border my-1 h-px" />
              <div onMouseEnter={() => setExportOpen(true)} onMouseLeave={() => setExportOpen(false)}>
                <Popover open={exportOpen} onOpenChange={setExportOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-full justify-start gap-2">
                      <Download className="h-4 w-4" />
                      <span>{t("toolbar.export")}</span>
                      <ChevronRight className="text-muted-foreground ml-auto h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="right" className="w-48 p-1">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => noteSummary && onExportNote?.(noteSummary, "html")}
                      >
                        <span>{t("toolbar.exportAsHTML")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => noteSummary && onExportNote?.(noteSummary, "pdf")}
                      >
                        <span>{t("toolbar.exportAsPDF")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => noteSummary && onExportNote?.(noteSummary, "pdf-pages")}
                      >
                        <span>{t("toolbar.exportAsPDFPages")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => noteSummary && onExportNote?.(noteSummary, "image")}
                      >
                        <span>{t("toolbar.exportAsImage")}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-full justify-start gap-2"
                        onClick={() => noteSummary && onExportNote?.(noteSummary, "image-pages")}
                      >
                        <span>{t("toolbar.exportAsImagePages")}</span>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="bg-border my-1 h-px" />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-8 w-full justify-start gap-2"
                onClick={handleDeleteNote}
              >
                <Trash2 className="h-4 w-4" />
                <span>{t("toolbar.delete")}</span>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
