import { Folder, FolderPlus, FileStack, FolderOpen, Trash2, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getSelectionBgColor, getHoverBgColor } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import { useNoteStore } from "@/stores/use-note-store";

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
  onCreateFolder?: () => void;
  onShowFolderInExplorer?: (folder: FolderItem) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
}

export function FolderTree({
  folders = [],
  selectedFolderId,
  totalNoteCount = 0,
  onSelectFolder,
  onCreateFolder,
  onShowFolderInExplorer,
  onDeleteFolder
}: FolderTreeProps) {
  // 是否选中「全部笔记」
  const isAllSelected = selectedFolderId === null;

  const setWorkspacePath = useWorkspaceStore((state) => state.setWorkspacePath);
  const loadFromFileSystem = useNoteStore((state) => state.loadFromFileSystem);

  // 处理切换工作区
  const handleSwitchWorkspace = async () => {
    try {
      // 打开文件夹选择对话框
      const selectedPath = await window.api.workspace.select();

      if (selectedPath) {
        // 更新工作区路径
        setWorkspacePath(selectedPath);

        // 扫描并加载工作区内容
        const data = await window.api.workspace.scan(selectedPath);
        loadFromFileSystem(data);
      }
    } catch (error) {
      console.error("选择工作区失败:", error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* 工作区名称 + 切换按钮 + 新建文件夹按钮 */}
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 px-3">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label="切换工作区"
                onClick={handleSwitchWorkspace}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>切换工作区</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                aria-label="新建文件夹"
                onClick={onCreateFolder}
              >
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
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="h-full">
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
                "sidebar-item flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
                isAllSelected ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onSelectFolder?.(null)}
            >
              <FileStack className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 truncate text-sm">全部笔记</div>
              <span className="text-tertiary-foreground shrink-0 text-xs tabular-nums">{totalNoteCount}</span>
            </motion.div>

            {/* 文件夹列表 */}
            {folders.map((folder, index) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <ContextMenu key={folder.id}>
                  <ContextMenuTrigger asChild>
                    <motion.div
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
                        "sidebar-item flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => onSelectFolder?.(folder.id)}
                    >
                      <Folder className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1 truncate text-sm">{folder.name}</div>
                      {folder.noteCount !== undefined && (
                        <span className="text-tertiary-foreground shrink-0 text-xs tabular-nums">
                          {folder.noteCount}
                        </span>
                      )}
                    </motion.div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onShowFolderInExplorer?.(folder)}>
                      <FolderOpen className="h-4 w-4" />
                      <span>在文件管理器中查看</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onDeleteFolder?.(folder)}>
                      <Trash2 className="h-4 w-4" />
                      <span>删除文件夹</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* 底部主题切换按钮 */}
      <div className="border-divider flex h-12 shrink-0 items-center justify-center border-t px-3">
        <ThemeToggle />
      </div>
    </div>
  );
}
