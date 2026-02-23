import { Folder, FolderPlus, FileStack, FolderOpen, Trash2, Pencil, Rss, RefreshCw, Unlink } from "lucide-react";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/app/list-row";
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
import { useRef, useState, useEffect } from "react";
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

  useEffect(() => {
    const handleCreate = () => onCreateFolder?.();
    const handleImportRss = () => onImportRss?.();
    window.addEventListener("app:open-create-folder", handleCreate);
    window.addEventListener("app:open-rss-import", handleImportRss);
    return () => {
      window.removeEventListener("app:open-create-folder", handleCreate);
      window.removeEventListener("app:open-rss-import", handleImportRss);
    };
  }, [onCreateFolder, onImportRss]);

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
          <ListRow
            layoutId="hover-bg"
            hovered={hoveredId === ALL_NOTES_FOLDER_ID}
            selected={isAllSelected}
            muted={!isAllSelected}
            leading={<FileStack className="h-4 w-4 shrink-0" />}
            label={t("allNotes")}
            trailing={<span className="text-tertiary-foreground text-xs tabular-nums">{totalNoteCount}</span>}
            onMouseEnter={() => setHoveredId(ALL_NOTES_FOLDER_ID)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectFolder?.(null)}
          />

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
                      className="absolute right-0 left-0"
                      ref={rowVirtualizer.measureElement}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <ListRow
                        layoutId="hover-bg"
                        hovered={isHovered}
                        selected={isSelected}
                        muted={!isSelected}
                        leading={
                          folder.isRss ? <Rss className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />
                        }
                        label={folder.name}
                        trailing={
                          folder.noteCount !== undefined ? (
                            <span className="text-tertiary-foreground text-xs tabular-nums">{folder.noteCount}</span>
                          ) : null
                        }
                        onMouseEnter={() => setHoveredId(folder.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => onSelectFolder?.(folder.id)}
                      />
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
