import { useState, useEffect } from "react";
import { Eye, FileText, Wand2, List, Pin, PinOff } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { TableOfContents } from "./table-of-contents";
import { useViewStore } from "@/stores/use-view-store";
import { useNoteStore } from "@/stores/use-note-store";
import { useTranslation } from "react-i18next";

interface EditorToolbarProps {
  fileName?: string;
  content?: string;
}

export function EditorToolbar({ fileName, content = "" }: EditorToolbarProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const toggleEditorMode = useViewStore((state) => state.toggleEditorMode);
  const formatCurrentNote = useNoteStore((state) => state.formatCurrentNote);
  const { t } = useTranslation("editor");
  const [tocOpen, setTocOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const handleFormat = () => {
    formatCurrentNote();
  };

  const isPreviewMode = editorMode === "preview";

  // 监听编辑模式变化，切换时关闭目录
  useEffect(() => {
    if (!isPreviewMode) {
      setTocOpen(false);
      setIsPinned(false); // 切换模式时取消固定
    }
  }, [isPreviewMode]);

  return (
    <div className="flex h-12 shrink-0 items-center justify-between px-3">
      {/* 左侧：文件名 */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {fileName && (
          <>
            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="text-foreground truncate text-sm font-medium">{fileName}</span>
          </>
        )}
      </div>

      {/* 右侧：工具按钮 */}
      <TooltipProvider delayDuration={300}>
        <motion.div
          className="flex shrink-0 items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* 预览按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={t("toolbar.preview")}
                pressed={editorMode === "preview"}
                onPressedChange={() => toggleEditorMode("preview")}
              >
                <Eye className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("toolbar.preview")}</p>
            </TooltipContent>
          </Tooltip>

          {/* 格式化按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label={t("toolbar.format")}
                onClick={handleFormat}
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("toolbar.format")}</p>
            </TooltipContent>
          </Tooltip>

          {/* 目录按钮 */}
          <Popover open={tocOpen} onOpenChange={setTocOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={t("toolbar.toc")}
                    disabled={!isPreviewMode}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t("toolbar.toc")}</p>
              </TooltipContent>
            </Tooltip>
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
        </motion.div>
      </TooltipProvider>
    </div>
  );
}
