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
  Link,
  Github
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ListRow } from "@/components/app/list-row";
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
import { useDraggable } from "@dnd-kit/core";
import { useViewStore, useNoteStore } from "@/stores";
import { useExternalMarkdownDrop } from "@/hooks";
import { workspaceIpc } from "@/ipc";
import { toast } from "sonner";

interface Note {
  id: string;
  title: string;
  filePath?: string;
  updatedAt?: string;
  isPinned?: boolean;
}

const NOTE_DRAG_PREFIX = "note-";

function setComposedRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref && "current" in ref) {
    (ref as React.RefObject<T | null>).current = value;
  }
}

function DraggableNoteRow({
  note,
  virtualRowIndex,
  virtualRowStart,
  measureRef,
  onDraggingChange,
  children,
  className: containerClassName,
  style: containerStyle,
  ...containerProps
}: {
  note: Note;
  virtualRowIndex: number;
  virtualRowStart: number;
  measureRef: (el: HTMLDivElement | null) => void;
  onDraggingChange?: (note: Note, isDragging: boolean) => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { ref: forwardedRef, ...restContainerProps } = containerProps as React.HTMLAttributes<HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement>;
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: NOTE_DRAG_PREFIX + note.id,
    data: { noteId: note.id }
  });
  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      measureRef(el);
      setNodeRef(el);
      setComposedRef(forwardedRef, el);
    },
    [forwardedRef, measureRef, setNodeRef]
  );
  const style: React.CSSProperties = {
    ...(containerStyle as React.CSSProperties),
    transform: `translateY(${virtualRowStart}px)`,
    opacity: isDragging ? 0.25 : 1
  };

  useEffect(() => {
    onDraggingChange?.(note, isDragging);
  }, [isDragging, note, onDraggingChange]);

  return (
    <div
      ref={refCallback}
      data-index={virtualRowIndex}
      data-note-item="true"
      className={cn("absolute right-0 left-0 px-2", isDragging ? "cursor-grabbing" : "cursor-grab", containerClassName)}
      style={style}
      {...restContainerProps}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

interface NoteListProps {
  notes?: Note[];
  selectedNoteId?: string;
  selectedNoteIds?: string[];
  searchKeyword?: string;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onCreateFromUrl?: () => void;
  onSearchChange?: (keyword: string) => void;
  onShowNoteInExplorer?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
  onDeleteNotes?: (noteIds: string[]) => void | Promise<void>;
  onRenameNote?: (note: Note) => void;
  onDuplicateNote?: (note: Note) => void;
  onTogglePinNote?: (note: Note) => void;
  onPinNotes?: (noteIds: string[]) => void | Promise<void>;
  onExportNote?: (note: Note, format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages") => void;
  onCopyToWechat?: (note: Note) => void;
  onPushToGitHub?: (note: Note) => void;
  onImportExternalMarkdownFiles?: (sourcePaths: string[]) => Promise<{ importedCount: number; skippedCount: number }>;
  onExternalFileDragHoverChange?: (hovering: boolean) => void;
  onSelectedNoteIdsChange?: (noteIds: string[]) => void;
}

export function NoteList({
  notes = [],
  selectedNoteId,
  selectedNoteIds = [],
  searchKeyword = "",
  onSelectNote,
  onCreateNote,
  onCreateFromUrl,
  onSearchChange,
  onShowNoteInExplorer,
  onDeleteNote,
  onDeleteNotes,
  onRenameNote,
  onDuplicateNote,
  onTogglePinNote,
  onPinNotes,
  onExportNote,
  onCopyToWechat,
  onPushToGitHub,
  onImportExternalMarkdownFiles,
  onExternalFileDragHoverChange,
  onSelectedNoteIdsChange
}: NoteListProps) {
  const { t } = useTranslation("note");
  const rootRef = useRef<HTMLDivElement>(null);
  const playingNoteIds = useNoteStore((state) => state.playingNoteIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const dragOutSessionRef = useRef<{
    activeNote: Note | null;
    dragOutStarted: boolean;
  }>({
    activeNote: null,
    dragOutStarted: false
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearchExpanded = useViewStore((state) => state.isNoteSearchExpanded);
  const setIsSearchExpanded = useViewStore((state) => state.setNoteSearchExpanded);
  const { isImportingExternal, dragHandlers } = useExternalMarkdownDrop({
    onImportExternalMarkdownFiles,
    onHoverChange: onExternalFileDragHoverChange
  });

  const handleSearchToggle = useCallback(() => {
    if (isSearchExpanded) {
      // 收起时清空搜索
      onSearchChange?.("");
      setIsSearchExpanded(false);
    } else {
      // 展开
      setIsSearchExpanded(true);
    }
  }, [isSearchExpanded, onSearchChange, setIsSearchExpanded]);

  useEffect(() => {
    const handleCreateFromUrl = () => onCreateFromUrl?.();
    const handleCreateNote = () => onCreateNote?.();
    window.addEventListener("app:open-url-create", handleCreateFromUrl);
    window.addEventListener("app:open-create-note", handleCreateNote);
    return () => {
      window.removeEventListener("app:open-url-create", handleCreateFromUrl);
      window.removeEventListener("app:open-create-note", handleCreateNote);
    };
  }, [onCreateFromUrl, onCreateNote]);

  useEffect(() => {
    const handleToggle = () => handleSearchToggle();
    window.addEventListener("app:toggle-note-search", handleToggle);
    return () => window.removeEventListener("app:toggle-note-search", handleToggle);
  }, [handleSearchToggle]);

  const handleSearchAnimationComplete = () => {
    // 动画完成后自动聚焦
    if (isSearchExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const parentRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds]);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

  const handleSelectRange = useCallback(
    (targetNoteId: string) => {
      const anchorId = selectionAnchorId ?? selectedNoteId ?? selectedNoteIds[0] ?? targetNoteId;
      const orderedIds = notes.map((note) => note.id);
      const startIndex = orderedIds.indexOf(anchorId);
      const endIndex = orderedIds.indexOf(targetNoteId);
      if (startIndex === -1 || endIndex === -1) {
        onSelectedNoteIdsChange?.([targetNoteId]);
        setSelectionAnchorId(targetNoteId);
        return;
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = orderedIds.slice(from, to + 1);
      onSelectedNoteIdsChange?.(rangeIds);
      setSelectionAnchorId(anchorId);
    },
    [notes, onSelectedNoteIdsChange, selectedNoteId, selectedNoteIds, selectionAnchorId]
  );

  const handleNotePointerDown = useCallback(
    (note: Note, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey) return;
      if (selectedSet.has(note.id)) return;
      onSelectedNoteIdsChange?.([note.id]);
      setSelectionAnchorId(note.id);
    },
    [onSelectedNoteIdsChange, selectedSet]
  );

  const handleNoteClick = useCallback(
    (note: Note, event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.shiftKey) {
        handleSelectRange(note.id);
        event.preventDefault();
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        const isCurrentSelectedVisible = selectedNoteId ? notes.some((item) => item.id === selectedNoteId) : false;
        const baseSelectedIds =
          selectedNoteIds.length > 0
            ? selectedNoteIds
            : isCurrentSelectedVisible && selectedNoteId
              ? [selectedNoteId]
              : [];
        const baseSet = new Set(baseSelectedIds);
        const nextSelected = baseSet.has(note.id)
          ? baseSelectedIds.filter((id) => id !== note.id)
          : [...baseSelectedIds, note.id];
        onSelectedNoteIdsChange?.(nextSelected);
        setSelectionAnchorId(note.id);
        event.preventDefault();
        return;
      }

      onSelectedNoteIdsChange?.([note.id]);
      setSelectionAnchorId(note.id);
      onSelectNote?.(note.id);
    },
    [handleSelectRange, notes, onSelectNote, onSelectedNoteIdsChange, selectedNoteId, selectedNoteIds]
  );

  const handleNoteContextMenu = useCallback(
    (note: Note) => {
      if (selectedSet.has(note.id)) {
        setSelectionAnchorId(note.id);
        return;
      }
      onSelectedNoteIdsChange?.([note.id]);
      setSelectionAnchorId(note.id);
    },
    [onSelectedNoteIdsChange, selectedSet]
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onSelectedNoteIdsChange?.([]);
      setSelectionAnchorId(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onSelectedNoteIdsChange]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (selectedNoteIds.length === 0) return;
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      const targetElement = event.target instanceof Element ? event.target : null;
      if (target && root.contains(target)) {
        const isClickingNoteItem = !!targetElement?.closest('[data-note-item="true"]');
        if (isClickingNoteItem) return;
      }
      onSelectedNoteIdsChange?.([]);
      setSelectionAnchorId(null);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown, true);
  }, [onSelectedNoteIdsChange, selectedNoteIds.length]);

  const handleNoteDraggingChange = useCallback((note: Note, isDragging: boolean) => {
    if (isDragging) {
      dragOutSessionRef.current.activeNote = note;
      dragOutSessionRef.current.dragOutStarted = false;
      return;
    }

    const currentNoteId = dragOutSessionRef.current.activeNote?.id;
    if (currentNoteId === note.id) {
      dragOutSessionRef.current.activeNote = null;
      dragOutSessionRef.current.dragOutStarted = false;
    }
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const { activeNote, dragOutStarted } = dragOutSessionRef.current;
      if (!activeNote?.filePath || dragOutStarted) return;
      const shouldStartDragOut =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth - 1 ||
        event.clientY >= window.innerHeight - 1;
      if (!shouldStartDragOut) return;

      dragOutSessionRef.current.dragOutStarted = true;
      void workspaceIpc.startDragOut(activeNote.filePath).catch(() => {
        dragOutSessionRef.current.dragOutStarted = false;
        toast.error(t("errors.dragOutFailed"));
      });
    };

    const handlePointerUp = () => {
      dragOutSessionRef.current.activeNote = null;
      dragOutSessionRef.current.dragOutStarted = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [t]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 6
  });

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col"
      onDragEnter={dragHandlers.onDragEnter}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
    >
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
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.preventDefault();
                    event.stopPropagation();
                    handleSearchToggle();
                  }}
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
      <div
        className={cn(
          "relative flex-1 overflow-hidden transition-colors duration-200",
          isImportingExternal && "pointer-events-none opacity-80"
        )}
      >
        {isImportingExternal && (
          <div className="text-muted-foreground border-divider bg-background/80 absolute top-2 right-2 left-2 z-10 rounded-md border px-2 py-1 text-center text-xs backdrop-blur-sm">
            {t("externalDrop.importingHint")}
          </div>
        )}
        <ScrollArea className="h-full overflow-hidden" viewportRef={parentRef}>
          {notes.length === 0 ? (
            <motion.div
              className="text-muted-foreground flex flex-col items-center justify-center p-6 text-center select-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Inbox className="mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">
                {searchKeyword ? t("emptyState.noResults") : t("emptyState.noNotes")}
              </p>
              <p className="text-tertiary-foreground mt-1 text-xs">
                {searchKeyword ? t("emptyState.tryOtherKeywords") : t("emptyState.createOrSelect")}
              </p>
            </motion.div>
          ) : (
            <div className="px-0" style={{ height: rowVirtualizer.getTotalSize() + 12, position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const note = notes[virtualRow.index];
                if (!note) return null;
                const isSelected = selectedNoteIds.length > 0 ? selectedSet.has(note.id) : selectedNoteId === note.id;
                const isHovered = hoveredId === note.id;
                const contextSelectedIds = selectedSet.has(note.id) ? selectedNoteIds : [note.id];
                const contextSelectedCount = contextSelectedIds.length;
                const isMultiContext = contextSelectedCount > 1;
                const contextHasUnpinned = contextSelectedIds.some((id) => !notesById.get(id)?.isPinned);
                return (
                  <ContextMenu key={note.id}>
                    <ContextMenuTrigger asChild>
                      <DraggableNoteRow
                        note={note}
                        virtualRowIndex={virtualRow.index}
                        virtualRowStart={virtualRow.start}
                        measureRef={rowVirtualizer.measureElement}
                        onDraggingChange={handleNoteDraggingChange}
                      >
                        <ListRow
                          layoutId="note-hover-bg"
                          hovered={isHovered}
                          selected={isSelected}
                          muted={!isSelected}
                          align="start"
                          descriptionFullWidth
                          onMouseEnter={() => setHoveredId(note.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onPointerDown={(event) => handleNotePointerDown(note, event)}
                          onClick={(event) => handleNoteClick(note, event)}
                          onContextMenu={() => handleNoteContextMenu(note)}
                          leading={
                            playingNoteIds.includes(note.id) ? (
                              <Volume2 className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <FileText
                                className={cn(
                                  "mt-0.5 h-3.5 w-3.5 shrink-0",
                                  isSelected ? "text-foreground" : "text-muted-foreground"
                                )}
                              />
                            )
                          }
                          label={note.title}
                          labelClassName={cn(isSelected ? "text-foreground" : "text-muted-foreground")}
                          description={
                            note.updatedAt ? (
                              <div
                                className={cn(
                                  "mt-1.5 flex items-center gap-2.5 text-xs leading-tight",
                                  isSelected ? "text-muted-foreground" : "text-muted-foreground/80"
                                )}
                              >
                                {note.isPinned ? (
                                  <Pin className={cn("h-3 w-3", isSelected ? "text-highlight" : "text-highlight/70")} />
                                ) : null}
                                <span>{formatDateTime(note.updatedAt)}</span>
                              </div>
                            ) : null
                          }
                        />
                      </DraggableNoteRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {isMultiContext ? (
                        <>
                          {contextHasUnpinned ? (
                            <>
                              <ContextMenuItem onClick={() => void onPinNotes?.(contextSelectedIds)}>
                                <Pin className="h-4 w-4" />
                                <span>{t("contextMenu.pinSelected", { count: contextSelectedCount })}</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                            </>
                          ) : null}
                          <ContextMenuItem onClick={() => void onDeleteNotes?.(contextSelectedIds)}>
                            <Trash2 className="h-4 w-4" />
                            <span>{t("contextMenu.deleteSelected", { count: contextSelectedCount })}</span>
                          </ContextMenuItem>
                        </>
                      ) : (
                        <>
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
                          <ContextMenuItem onClick={() => onPushToGitHub?.(note)}>
                            <Github className="h-4 w-4" />
                            <span>{t("contextMenu.pushToGitHub")}</span>
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
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
