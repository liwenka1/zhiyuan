import {
  FileText,
  Inbox,
  SquarePen,
  Pin,
  PinOff,
  Search,
  Trash2,
  Copy,
  Pencil,
  Download,
  X,
  FolderOpen,
  Volume2,
  Link
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { cn, formatDateTime } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useViewStore, useNoteStore } from "@/stores";

interface Note {
  id: string;
  title: string;
  updatedAt?: string;
  isPinned?: boolean;
}

interface NoteListProps {
  notes?: Note[];
  selectedNoteId?: string;
  searchKeyword?: string;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onCreateFromUrl?: () => void;
  onSearchChange?: (keyword: string) => void;
  onShowNoteInExplorer?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
  onRenameNote?: (note: Note) => void;
  onDuplicateNote?: (note: Note) => void;
  onTogglePinNote?: (note: Note) => void;
  onExportNote?: (note: Note, format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages") => void;
  onCopyToWechat?: (note: Note) => void;
}

export function NoteList({
  notes = [],
  selectedNoteId,
  searchKeyword = "",
  onSelectNote,
  onCreateNote,
  onCreateFromUrl,
  onSearchChange,
  onShowNoteInExplorer,
  onDeleteNote,
  onRenameNote,
  onDuplicateNote,
  onTogglePinNote,
  onExportNote,
  onCopyToWechat
}: NoteListProps) {
  const { t } = useTranslation("note");
  const playingNoteIds = useNoteStore((state) => state.playingNoteIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearchExpanded = useViewStore((state) => state.isNoteSearchExpanded);
  const setIsSearchExpanded = useViewStore((state) => state.setNoteSearchExpanded);

  const handleSearchToggle = () => {
    if (isSearchExpanded) {
      // 收起时清空搜索
      onSearchChange?.("");
      setIsSearchExpanded(false);
    } else {
      // 展开
      setIsSearchExpanded(true);
    }
  };

  const handleSearchAnimationComplete = () => {
    // 动画完成后自动聚焦
    if (isSearchExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const parentRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 6
  });

  return (
    <div className="flex h-full flex-col">
      {/* 顶部搜索栏 */}
      <div className="flex h-12 shrink-0 items-center gap-2 overflow-hidden px-3">
        <AnimatePresence mode="wait" initial={false}>
          {isSearchExpanded ? (
            // 展开的搜索框
            <motion.div
              key="search-input"
              className="relative flex-1"
              initial={{ opacity: 0, width: 0 }}
              animate={{
                opacity: 1,
                width: "100%",
                transition: {
                  duration: 0.2,
                  ease: [0.32, 0.72, 0, 1]
                }
              }}
              exit={{
                opacity: 0,
                width: 0,
                transition: {
                  duration: 0.15,
                  ease: [0.32, 0.72, 0, 1]
                }
              }}
              onAnimationComplete={handleSearchAnimationComplete}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { delay: 0.08, duration: 0.15 }
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.08 }
                }}
              >
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={t("search")}
                  value={searchKeyword}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="bg-muted/50 h-8 border-none pr-8 pl-8 text-sm focus-visible:ring-1 [&::-webkit-search-cancel-button]:hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 cursor-pointer p-0"
                  onClick={handleSearchToggle}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            </motion.div>
          ) : (
            // 收起状态：按钮组
            <motion.div
              key="buttons"
              className="flex w-full items-center justify-between gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{
                opacity: 1,
                x: 0,
                transition: {
                  duration: 0.18,
                  ease: [0.32, 0.72, 0, 1]
                }
              }}
              exit={{
                opacity: 0,
                x: 10,
                transition: {
                  duration: 0.15,
                  ease: [0.32, 0.72, 0, 1]
                }
              }}
            >
              {/* 从 URL 新建 + 新建笔记 + 搜索按钮 */}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 cursor-pointer p-0"
                  aria-label={t("createFromUrl")}
                  onClick={onCreateFromUrl}
                >
                  <Link className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 cursor-pointer p-0"
                  aria-label={t("newNote")}
                  onClick={onCreateNote}
                >
                  <SquarePen className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 cursor-pointer p-0"
                  aria-label={t("search")}
                  onClick={handleSearchToggle}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 笔记列表 */}
      <ScrollArea className="flex-1 overflow-hidden" viewportRef={parentRef}>
        {notes.length === 0 ? (
          <motion.div
            className="text-muted-foreground flex flex-col items-center justify-center p-6 text-center select-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Inbox className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">{searchKeyword ? t("emptyState.noResults") : t("emptyState.noNotes")}</p>
            <p className="text-tertiary-foreground mt-1 text-xs">
              {searchKeyword ? t("emptyState.tryOtherKeywords") : t("emptyState.createOrSelect")}
            </p>
          </motion.div>
        ) : (
          <div className="px-0" style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const note = notes[virtualRow.index];
              if (!note) return null;
              const isSelected = selectedNoteId === note.id;
              const isHovered = hoveredId === note.id;
              return (
                <ContextMenu key={note.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="absolute right-0 left-0 px-2"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      onMouseEnter={() => setHoveredId(note.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onSelectNote?.(note.id)}
                    >
                      <div className="group relative cursor-pointer overflow-hidden rounded-md px-3 py-2">
                        {/* hover 背景 - 滑动跟随 */}
                        <motion.div
                          layoutId="note-hover-bg"
                          className="bg-accent absolute inset-0 rounded-md"
                          initial={false}
                          animate={{ opacity: isHovered ? 1 : 0 }}
                          transition={{ type: "spring", stiffness: 1200, damping: 40, mass: 0.3 }}
                        />

                        {/* 选中背景 */}
                        <div
                          className={cn(
                            "bg-accent absolute inset-0 rounded-md",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />

                        {/* 标题行 */}
                        <div className="relative z-10 flex min-w-0 items-start gap-2">
                          {playingNoteIds.includes(note.id) ? (
                            <Volume2 className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <FileText
                              className={cn(
                                "mt-0.5 h-3.5 w-3.5 shrink-0",
                                isSelected ? "text-foreground" : "text-muted-foreground"
                              )}
                            />
                          )}
                          <div
                            className={cn(
                              "min-w-0 flex-1 truncate text-sm leading-tight font-medium",
                              isSelected ? "text-foreground" : "text-foreground/90"
                            )}
                          >
                            {note.title}
                          </div>
                        </div>

                        {/* 日期行 */}
                        {note.updatedAt && (
                          <div
                            className={cn(
                              "relative z-10 mt-1.5 flex items-center gap-2.5 text-xs leading-tight",
                              isSelected ? "text-muted-foreground" : "text-muted-foreground/80"
                            )}
                          >
                            {note.isPinned ? (
                              <Pin className={cn("h-3 w-3", isSelected ? "text-highlight" : "text-highlight/70")} />
                            ) : null}
                            <span>{formatDateTime(note.updatedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onShowNoteInExplorer?.(note)}>
                      <FolderOpen className="h-4 w-4" />
                      <span>{t("contextMenu.showInExplorer")}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onTogglePinNote?.(note)}>
                      {note.isPinned ? (
                        <>
                          <PinOff className="h-4 w-4" />
                          <span>{t("contextMenu.unpin")}</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-4 w-4" />
                          <span>{t("contextMenu.pin")}</span>
                        </>
                      )}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onRenameNote?.(note)}>
                      <Pencil className="h-4 w-4" />
                      <span>{t("contextMenu.rename")}</span>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onDuplicateNote?.(note)}>
                      <Copy className="h-4 w-4" />
                      <span>{t("contextMenu.duplicate")}</span>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <Download className="h-4 w-4" />
                        <span>{t("contextMenu.export")}</span>
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        <ContextMenuItem onClick={() => onExportNote?.(note, "html")}>
                          <span>{t("contextMenu.exportAsHTML")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onExportNote?.(note, "pdf")}>
                          <span>{t("contextMenu.exportAsPDF")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onExportNote?.(note, "pdf-pages")}>
                          <span>{t("contextMenu.exportAsPDFPages")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onExportNote?.(note, "image")}>
                          <span>{t("contextMenu.exportAsImage")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onExportNote?.(note, "image-pages")}>
                          <span>{t("contextMenu.exportAsImagePages")}</span>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onCopyToWechat?.(note)}>
                          <span>{t("contextMenu.copyToWechat")}</span>
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onDeleteNote?.(note)}>
                      <Trash2 className="h-4 w-4" />
                      <span>{t("contextMenu.delete")}</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
