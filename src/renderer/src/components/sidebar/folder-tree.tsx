import { Folder, FolderPlus, Inbox } from "lucide-react";
import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  noteCount?: number;
}

interface FolderTreeProps {
  folders?: FolderItem[];
  selectedFolderId?: string;
  onSelectFolder?: (folderId: string) => void;
}

export function FolderTree({ folders = [], selectedFolderId, onSelectFolder }: FolderTreeProps) {
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
        {folders.length === 0 ? (
          <motion.div
            className="empty-state text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Inbox className="empty-state-icon mb-3 h-10 w-10" />
            <p className="text-sm font-medium">暂无文件夹</p>
            <p className="text-tertiary-foreground mt-1 text-xs">点击 + 创建文件夹</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5 p-2">
            {folders.map((folder, index) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  whileHover={isSelected ? {} : { backgroundColor: "hsl(var(--muted))" }}
                  className={cn(
                    "sidebar-item flex cursor-pointer items-center gap-2 rounded-md px-3 py-2",
                    isSelected ? "bg-selection text-foreground" : "text-muted-foreground hover:text-foreground"
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
        )}
      </ScrollArea>
    </div>
  );
}
