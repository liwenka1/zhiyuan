import {
  Folder,
  FolderPlus,
  FileStack,
  FolderOpen,
  Trash2,
  Pencil,
  Rss,
  RefreshCw,
  Unlink,
  HardDrive,
  ListTree
} from "lucide-react";

import { useDroppable } from "@dnd-kit/core";
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

import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useViewStore } from "@/stores/use-view-store";

// 特殊 ID 表示「全部笔记」
export const ALL_NOTES_FOLDER_ID = "__all__";

const FOLDER_DROP_PREFIX = "folder-";

function setComposedRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && "current" in ref) {
    (ref as React.RefObject<T | null>).current = value;
  }
}

function DroppableFolderRow({
  droppableId,
  isSelected,
  isHovered,
  onSelectFolder,
  onMouseEnter,
  onMouseLeave,
  leading,
  label,
  trailing,
  ...containerProps
}: {
  droppableId: string;
  isSelected: boolean;
  isHovered: boolean;
  onSelectFolder: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  leading: React.ReactNode;
  label: React.ReactNode;
  trailing: React.ReactNode | null;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { ref: forwardedRef, ...restContainerProps } = containerProps as React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>;
  };
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId
  });
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      setComposedRef(forwardedRef, el);
    },
    [forwardedRef, setNodeRef]
  );

  return (
    <div ref={refCallback} {...restContainerProps}>
      <ListRow
        data-selected-folder={isSelected || undefined}
        layoutId="hover-bg"
        hovered={isHovered || isOver}
        selected={isSelected}
        muted={!isSelected}
        className={cn("focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-inset", isOver && "bg-accent")}
        leading={leading}
        label={label}
        trailing={trailing}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onSelectFolder}
      />
    </div>
  );
}

interface FolderItem {
  id: string;
  name: string;
  path?: string;
  noteCount?: number;
  isRss?: boolean;
}

interface FolderTreeProps {
  folders?: FolderItem[];
  selectedFolderId?: string | null;
  totalNoteCount?: number;
  settingsButton: ReactNode;
  onSelectFolder?: (folderId: string | null) => void;
  onCreateFolder?: () => void;
  onImportRss?: () => void;
  onUpdateRss?: (folder: FolderItem) => void;
  onUnsubscribeRss?: (folder: FolderItem) => void;
  onShowFolderInExplorer?: (folder: FolderItem) => void;
  onCopyFolderRelativePath?: (folder: FolderItem) => void | Promise<void>;
  onCopyFolderAbsolutePath?: (folder: FolderItem) => void | Promise<void>;
  onDeleteFolder?: (folder: FolderItem) => void;
  onRenameFolder?: (folder: FolderItem) => void;
}

export function FolderTree({
  folders = [],
  selectedFolderId,
  totalNoteCount = 0,
  settingsButton,
  onSelectFolder,
  onCreateFolder,
  onImportRss,
  onUpdateRss,
  onUnsubscribeRss,
  onShowFolderInExplorer,
  onCopyFolderRelativePath,
  onCopyFolderAbsolutePath,
  onDeleteFolder,
  onRenameFolder
}: FolderTreeProps) {
  const { t } = useTranslation("sidebar");
  const showFolderSidebar = useViewStore((state) => state.showFolderSidebar);
  const folderRevealRequest = useViewStore((state) => state.folderRevealRequest);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const folderListRef = useRef<HTMLDivElement>(null);
  const lastFolderRevealRequest = useRef(folderRevealRequest);
  // 是否选中「全部笔记」
  const isAllSelected = selectedFolderId === null;

  useEffect(() => {
    const shouldFocus = lastFolderRevealRequest.current !== folderRevealRequest;
    lastFolderRevealRequest.current = folderRevealRequest;
    if (!showFolderSidebar) return;
    const selectedFolder = folderListRef.current?.querySelector<HTMLButtonElement>("[data-selected-folder]");
    selectedFolder?.scrollIntoView({ block: "nearest" });
    if (shouldFocus) selectedFolder?.focus({ preventScroll: true });
  }, [selectedFolderId, showFolderSidebar, folderRevealRequest]);

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
        "@container/folders flex h-full flex-col transition-opacity duration-200",
        showFolderSidebar ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-end gap-2 px-3 pl-11 @max-[120px]/folders:gap-1 @max-[120px]/folders:pr-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 @max-[120px]/folders:w-6"
          aria-label={t("importRss")}
          onClick={onImportRss}
        >
          <Rss className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 @max-[120px]/folders:w-6"
          aria-label={t("newFolder")}
          onClick={onCreateFolder}
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* 文件夹列表 */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div ref={folderListRef} className="space-y-0.5 px-2 pb-3">
          {/* 全部笔记 - 始终显示在最上方 */}
          <ListRow
            data-selected-folder={isAllSelected || undefined}
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
          <div className="space-y-0.5">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              const isHovered = hoveredId === folder.id;
              return (
                <ContextMenu key={folder.id}>
                  <ContextMenuTrigger asChild>
                    <DroppableFolderRow
                      droppableId={FOLDER_DROP_PREFIX + folder.id}
                      isSelected={isSelected}
                      isHovered={isHovered}
                      onSelectFolder={() => onSelectFolder?.(folder.id)}
                      onMouseEnter={() => setHoveredId(folder.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      leading={
                        folder.isRss ? <Rss className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />
                      }
                      label={folder.name}
                      trailing={
                        folder.noteCount !== undefined ? (
                          <span className="text-tertiary-foreground text-xs tabular-nums">{folder.noteCount}</span>
                        ) : null
                      }
                    />
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onShowFolderInExplorer?.(folder)}>
                      <FolderOpen className="h-4 w-4" />
                      <span>{t("contextMenu.showInExplorer")}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => void onCopyFolderRelativePath?.(folder)}>
                      <ListTree className="h-4 w-4" />
                      <span>{t("contextMenu.copyRelativePath")}</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => void onCopyFolderAbsolutePath?.(folder)}>
                      <HardDrive className="h-4 w-4" />
                      <span>{t("contextMenu.copyAbsolutePath")}</span>
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
      <div className="border-divider flex h-12 shrink-0 items-center justify-center border-t px-3">
        {settingsButton}
      </div>
    </div>
  );
}
