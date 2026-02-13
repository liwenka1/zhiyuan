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

import { SettingsPopover } from "@/components/app";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
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
          <div
            className={cn(
              "group relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
              isAllSelected ? "text-foreground font-medium" : "text-muted-foreground"
            )}
            onMouseEnter={() => setHoveredId(ALL_NOTES_FOLDER_ID)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectFolder?.(null)}
          >
            {/* Hover 高亮指示器 - 使用 CSS 过渡实现更平滑的效果 */}
            <motion.div
              layoutId="folder-hover-highlight"
              className="bg-muted absolute inset-0 rounded-md"
              initial={false}
              animate={{
                opacity: hoveredId === ALL_NOTES_FOLDER_ID && !isAllSelected ? 1 : 0
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 0.8
              }}
              style={{ willChange: "transform, opacity" }}
            />

            {/* 选中背景 */}
            {isAllSelected && (
              <motion.div
                layoutId="folder-selection-highlight"
                className="bg-accent absolute inset-0 rounded-md"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 28,
                  mass: 0.8
                }}
                style={{ willChange: "transform" }}
              />
            )}

            {/* 选中项 hover 时的微妙边框提示 */}
            {isAllSelected && hoveredId === ALL_NOTES_FOLDER_ID && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="ring-primary/20 absolute inset-0 rounded-md ring-1 ring-inset"
              />
            )}

            <FileStack className="relative z-10 h-4 w-4 shrink-0" />
            <div className="relative z-10 min-w-0 flex-1 truncate text-sm">{t("allNotes")}</div>
            <span className="text-tertiary-foreground relative z-10 shrink-0 text-xs tabular-nums">
              {totalNoteCount}
            </span>
          </div>

          {/* 文件夹列表 */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const folder = folders[virtualRow.index];
              if (!folder) return null;
              const isSelected = selectedFolderId === folder.id;
              const isHovered = hoveredId === folder.id;
              return (
                <ContextMenu key={folder.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        "group absolute right-0 left-0 flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                      )}
                      ref={rowVirtualizer.measureElement}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      onMouseEnter={() => setHoveredId(folder.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onSelectFolder?.(folder.id)}
                    >
                      {/* Hover 指示器 - 统一的 layoutId 实现滑动效果 */}
                      <motion.div
                        layoutId="folder-hover-highlight"
                        className="bg-muted absolute inset-0 rounded-md"
                        initial={false}
                        animate={{
                          opacity: isHovered && !isSelected ? 1 : 0
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 28,
                          mass: 0.8
                        }}
                        style={{ willChange: "transform, opacity" }}
                      />

                      {/* 选中背景 */}
                      {isSelected && (
                        <motion.div
                          layoutId="folder-selection-highlight"
                          className="bg-accent absolute inset-0 rounded-md"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 28,
                            mass: 0.8
                          }}
                          style={{ willChange: "transform" }}
                        />
                      )}

                      {/* 选中项 hover 时的微妙边框提示 */}
                      {isSelected && isHovered && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="ring-primary/20 absolute inset-0 rounded-md ring-1 ring-inset"
                        />
                      )}
                      {folder.isRss ? (
                        <Rss className="relative z-10 h-4 w-4 shrink-0" />
                      ) : (
                        <Folder className="relative z-10 h-4 w-4 shrink-0" />
                      )}
                      <div className="relative z-10 min-w-0 flex-1 truncate text-sm">{folder.name}</div>
                      {folder.noteCount !== undefined && (
                        <span className="text-tertiary-foreground relative z-10 shrink-0 text-xs tabular-nums">
                          {folder.noteCount}
                        </span>
                      )}
                    </div>
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

      {/* 底部设置 */}
      <div className="border-divider flex h-12 shrink-0 items-center justify-center border-t px-3">
        <SettingsPopover />
      </div>
    </div>
  );
}
