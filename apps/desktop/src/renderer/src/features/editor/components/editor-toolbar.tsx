import { useState, useEffect } from "react";
import { Eye, Wand2, List, Pin, PinOff, Presentation, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TableOfContents } from "./table-of-contents";
import { useViewStore } from "@/stores";
import { useNoteStore } from "@/stores";
import { useTranslation } from "react-i18next";

interface EditorToolbarProps {
  content?: string;
}

export function EditorToolbar({ content = "" }: EditorToolbarProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const toggleEditorMode = useViewStore((state) => state.toggleEditorMode);
  const enterPresentationMode = useViewStore((state) => state.enterPresentationMode);
  const formatCurrentNote = useNoteStore((state) => state.formatCurrentNote);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const { t } = useTranslation("editor");
  const [tocOpen, setTocOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const handleFormat = () => {
    formatCurrentNote();
  };

  const isPreviewMode = editorMode === "preview";
  const isSplitMode = editorMode === "split";
  const hasNote = !!selectedNoteId;
  const showPreview = isPreviewMode || isSplitMode; // 预览或分栏模式下都显示预览内容

  // 监听编辑模式变化，切换到编辑模式时关闭目录
  useEffect(() => {
    if (editorMode === "edit") {
      setTocOpen(false);
      setIsPinned(false); // 切换模式时取消固定
    }
  }, [editorMode]);

  return (
    <div className="flex h-12 shrink-0 items-center justify-end px-3">
      {/* 工具按钮 */}
      <div className="flex shrink-0 items-center gap-1">
        {/* 预览按钮 */}
        <Toggle
          size="sm"
          className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary h-8 w-8 p-0"
          aria-label={t("toolbar.preview")}
          pressed={editorMode === "preview"}
          onPressedChange={() => toggleEditorMode("preview")}
          disabled={!hasNote || isSplitMode}
        >
          <Eye className="h-4 w-4" />
        </Toggle>

        {/* 分栏按钮 */}
        <Toggle
          size="sm"
          className="hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary/10 data-[state=on]:text-primary h-8 w-8 p-0"
          aria-label={t("toolbar.split")}
          pressed={editorMode === "split"}
          onPressedChange={() => toggleEditorMode("split")}
          disabled={!hasNote || isPreviewMode}
        >
          <Columns2 className="h-4 w-4" />
        </Toggle>

        {/* 演示按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={t("toolbar.presentation")}
          onClick={enterPresentationMode}
          disabled={!hasNote}
        >
          <Presentation className="h-4 w-4" />
        </Button>

        {/* 格式化按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={t("toolbar.format")}
          onClick={handleFormat}
          disabled={!hasNote || editorMode === "preview"}
        >
          <Wand2 className="h-4 w-4" />
        </Button>

        {/* 目录按钮 */}
        <Popover open={tocOpen} onOpenChange={setTocOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={t("toolbar.toc")}
              disabled={!hasNote || !showPreview}
            >
              <List className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80"
            onInteractOutside={(e) => {
              // 如果已固定，阻止点击外部关闭
              if (isPinned) {
                e.preventDefault();
              }
            }}
            onEscapeKeyDown={(e) => {
              // 如果已固定，阻止 ESC 键关闭
              if (isPinned) {
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
                  onClick={() => setIsPinned(!isPinned)}
                  aria-label={isPinned ? t("toc.unpin") : t("toc.pin")}
                >
                  {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <TableOfContents content={content} />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
