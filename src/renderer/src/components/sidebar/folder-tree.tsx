import { Folder, FolderPlus, FileStack } from "lucide-react";
import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getSelectionBgColor, getHoverBgColor } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme";

// 特殊 ID 表示「全部笔记」
export const ALL_NOTES_FOLDER_ID = "__all__";

interface FolderItem {
  id: string;
  name: string;
  noteCount?: number;
}

interface FolderTreeProps {
  folders?: FolderItem[];
  selectedFolderId?: string | null;
  totalNoteCount?: number;
  onSelectFolder?: (folderId: string | null) => void;
}

export function FolderTree({ folders = [], selectedFolderId, totalNoteCount = 0, onSelectFolder }: FolderTreeProps) {
  // 是否选中「全部笔记」
  const isAllSelected = selectedFolderId === null;

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏 */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">文件夹</span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="新建文件夹">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>新建文件夹</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 文件夹列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {/* 全部笔记 - 始终显示在最上方 */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{
              opacity: 1,
              x: 0,
              backgroundColor: getSelectionBgColor(isAllSelected)
            }}
            whileHover={{
              backgroundColor: getHoverBgColor(isAllSelected)
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              "sidebar-item flex cursor-pointer items-center gap-2 rounded-md px-3 py-2",
              isAllSelected ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onSelectFolder?.(null)}
          >
            <FileStack className="h-4 w-4 shrink-0" />
            <span className="truncate-text flex-1 text-sm">全部笔记</span>
            <span className="text-tertiary-foreground text-xs tabular-nums">{totalNoteCount}</span>
          </motion.div>

          {/* 文件夹列表 */}
          {folders.map((folder, index) => {
            const isSelected = selectedFolderId === folder.id;
            return (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  backgroundColor: getSelectionBgColor(isSelected)
                }}
                whileHover={{
                  backgroundColor: getHoverBgColor(isSelected)
                }}
                transition={{ duration: 0.2, delay: (index + 1) * 0.03 }}
                className={cn(
                  "sidebar-item flex cursor-pointer items-center gap-2 rounded-md px-3 py-2",
                  isSelected ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onSelectFolder?.(folder.id)}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="truncate-text flex-1 text-sm">{folder.name}</span>
                {folder.noteCount !== undefined && (
                  <span className="text-tertiary-foreground text-xs tabular-nums">{folder.noteCount}</span>
                )}
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>

      {/* 底部主题切换按钮 */}
      <div className="border-divider flex h-12 shrink-0 items-center justify-center border-t px-3">
        <ThemeToggle />
      </div>
    </div>
  );
}
