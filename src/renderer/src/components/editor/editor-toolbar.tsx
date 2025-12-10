import { Eye, Presentation, Wand2 } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function EditorToolbar() {
  return (
    <div className="border-divider flex h-12 shrink-0 items-center justify-end border-b px-3">
      <TooltipProvider delayDuration={300}>
        <motion.div
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* 预览按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle size="sm" className="h-8 w-8 p-0" aria-label="预览">
                <Eye className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>预览</p>
            </TooltipContent>
          </Tooltip>

          {/* 演示按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle size="sm" className="h-8 w-8 p-0" aria-label="演示">
                <Presentation className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>演示模式</p>
            </TooltipContent>
          </Tooltip>

          {/* 格式化按钮 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="格式化">
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
