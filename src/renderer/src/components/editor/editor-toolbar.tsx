import { Eye, FileText, Presentation, Wand2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewStore } from "@/stores/use-view-store";
import { useNoteStore } from "@/stores/use-note-store";

interface EditorToolbarProps {
  fileName?: string;
}

export function EditorToolbar({ fileName }: EditorToolbarProps) {
  const editorMode = useViewStore((state) => state.editorMode);
  const toggleEditorMode = useViewStore((state) => state.toggleEditorMode);
  const setViewMode = useViewStore((state) => state.setViewMode);
  const formatCurrentNote = useNoteStore((state) => state.formatCurrentNote);

  const handleFormat = () => {
    formatCurrentNote();
  };

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
                aria-label="预览"
                pressed={editorMode === "preview"}
                onPressedChange={() => toggleEditorMode("preview")}
              >
                <Eye className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>预览模式</p>
            </TooltipContent>
          </Tooltip>

          {/* 演示按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="演示"
                onClick={() => setViewMode("presentation")}
              >
                <Presentation className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>演示模式</p>
            </TooltipContent>
          </Tooltip>

          {/* 格式化按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="格式化" onClick={handleFormat}>
                <Wand2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>格式化</p>
            </TooltipContent>
          </Tooltip>
        </motion.div>
      </TooltipProvider>
    </div>
  );
}
