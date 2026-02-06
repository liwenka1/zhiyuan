import { Folder, FolderPlus, FileStack, FolderOpen, Trash2, Pencil, Rss, RefreshCw, Unlink } from "lucide-react";
import { motion } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { getSelectionBgColor, getHoverBgColor } from "@/lib/theme";
import { ThemeToggle, LanguageToggle, WorkspaceToggle } from "@/components/app";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { useViewStore } from "@/stores";

// 特殊 ID 表示「全部笔记」
export const ALL_NOTES_FOLDER_ID = "__all__";

interface FolderItem {
  id: string;
  name: string;
  noteCount?: number;
  isRss?: boolean;
}

interface FolderTreeProps {
  folders?: FolderItem[];
  selectedFolderId?: string | null;
  totalNoteCount?: number;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateFolder?: () => void;
  onImportRss?: () => void;
  onUpdateRss?: (folder: FolderItem) => void;
  onUnsubscribeRss?: (folder: FolderItem) => void;
  onShowFolderInExplorer?: (folder: FolderItem) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
  onRenameFolder?: (folder: FolderItem) => void;
}

export function FolderTree({
  folders = [],
  selectedFolderId,
  totalNoteCount = 0,
  onSelectFolder,
  onCreateFolder,
  onImportRss,
  onUpdateRss,
  onUnsubscribeRss,
  onShowFolderInExplorer,
  onDeleteFolder,
  onRenameFolder
}: FolderTreeProps) {
  const { t } = useTranslation("sidebar");
  const showFolderSidebar = useViewStore((state) => state.showFolderSidebar);
  // 是否选中「全部笔记」
  const isAllSelected = selectedFolderId === null;
  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: folders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 6
  });

  return (
    <div
      className={cn(
        "flex h-full flex-col transition-opacity duration-200",
        showFolderSidebar ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* 顶部区域：新建文件夹按钮（给切换按钮留出空间） */}
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 px-3 pl-11">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label={t("importRss")}
          onClick={onImportRss}
        >
          <Rss className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label={t("newFolder")}
          onClick={onCreateFolder}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* 文件夹列表 */}
      <ScrollArea className="flex-1 overflow-hidden" viewportRef={parentRef}>
        <div className="space-y-0.5 px-2">
          {/* 全部笔记 - 始终显示在最上方 */}
          <motion.div
            animate={{
              backgroundColor: getSelectionBgColor(isAllSelected)
            }}
            whileHover={{
              backgroundColor: getHoverBgColor(isAllSelected)
            }}
            transition={{ duration: 0.1 }}
            className={cn(
              "flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
              isAllSelected ? "text-foreground font-medium" : "text-muted-foreground"
            )}
            onClick={() => onSelectFolder?.(null)}
          >
            <FileStack className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 truncate text-sm">{t("allNotes")}</div>
            <span className="text-tertiary-foreground shrink-0 text-xs tabular-nums">{totalNoteCount}</span>
          </motion.div>

          {/* 文件夹列表 */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const folder = folders[virtualRow.index];
              if (!folder) return null;
              const isSelected = selectedFolderId === folder.id;
              return (
                <ContextMenu key={folder.id}>
                  <ContextMenuTrigger asChild>
                    <motion.div
                      animate={{
                        backgroundColor: getSelectionBgColor(isSelected)
                      }}
                      whileHover={{
                        backgroundColor: getHoverBgColor(isSelected)
                      }}
                      transition={{ duration: 0.1 }}
                      className={cn(
                        "absolute right-0 left-0 flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                      ref={rowVirtualizer.measureElement}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      onClick={() => onSelectFolder?.(folder.id)}
                    >
                      {folder.isRss ? <Rss className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
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
                      <span>{t("contextMenu.showInExplorer")}</span>
                    </ContextMenuItem>
                    {folder.isRss && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onUpdateRss?.(folder)}>
                          <RefreshCw className="h-4 w-4" />
                          <span>{t("contextMenu.updateRss")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onUnsubscribeRss?.(folder)}>
                          <Unlink className="h-4 w-4" />
                          <span>{t("contextMenu.unsubscribeRss")}</span>
                        </ContextMenuItem>
                      </>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onRenameFolder?.(folder)}>
                      <Pencil className="h-4 w-4" />
                      <span>{t("contextMenu.rename")}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onDeleteFolder?.(folder)}>
                      <Trash2 className="h-4 w-4" />
                      <span>{t("contextMenu.deleteFolder")}</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* 底部全局设置按钮 */}
      <div className="border-divider flex h-12 shrink-0 items-center justify-center gap-2 border-t px-3">
        <WorkspaceToggle />
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </div>
  );
}
