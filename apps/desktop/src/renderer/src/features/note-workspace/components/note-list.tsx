import {
  FileText,
  Inbox,
  SquarePen,
  Pin,
  PinOff,
  Trash2,
  Copy,
  Pencil,
  Download,
  FolderOpen,
  Volume2,
  Link,
  Github,
  HardDrive,
  ListTree
} from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ListRow } from "@/components/app/list-row";
import { DropHoverMask } from "@/components/app";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useNoteStore } from "@/stores";
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

export interface NoteListSelection {
  noteIds: string[];
  anchorId: string | null;
}

interface NoteListProps {
  notes?: Note[];
  selectedNoteId?: string;
  selectedNoteIds?: string[];
  selectionAnchorId?: string | null;
  onSelectNote?: (noteId: string) => void;
  onCreateNote?: () => void;
  onCreateFromUrl?: () => void;
  onShowNoteInExplorer?: (note: Note) => void;
  onCopyNoteRelativePath?: (note: Note) => void | Promise<void>;
  onCopyNoteAbsolutePath?: (note: Note) => void | Promise<void>;
  onCopyNotesRelativePaths?: (noteIds: string[]) => void | Promise<void>;
  onCopyNotesAbsolutePaths?: (noteIds: string[]) => void | Promise<void>;
  onDeleteNote?: (note: Note) => void;
  onDeleteNotes?: (noteIds: string[]) => void | Promise<void>;
  onRenameNote?: (note: Note) => void;
  onDuplicateNote?: (note: Note) => void;
  onDuplicateNotes?: (noteIds: string[]) => void | Promise<void>;
  onTogglePinNote?: (note: Note) => void;
  onPinNotes?: (noteIds: string[]) => void | Promise<void>;
  onExportNote?: (note: Note, format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages") => void;
  onCopyToWechat?: (note: Note) => void;
  onPushToGitHub?: (note: Note) => void;
  onImportExternalMarkdownFiles?: (sourcePaths: string[]) => Promise<{ importedCount: number; skippedCount: number }>;
  onSelectionChange?: (selection: NoteListSelection) => void;
}

export function NoteList({
  notes = [],
  selectedNoteId,
  selectedNoteIds = [],
  selectionAnchorId = null,
  onSelectNote,
  onCreateNote,
  onCreateFromUrl,
  onShowNoteInExplorer,
  onCopyNoteRelativePath,
  onCopyNoteAbsolutePath,
  onCopyNotesRelativePaths,
  onCopyNotesAbsolutePaths,
  onDeleteNote,
  onDeleteNotes,
  onRenameNote,
  onDuplicateNote,
  onDuplicateNotes,
  onTogglePinNote,
  onPinNotes,
  onExportNote,
  onCopyToWechat,
  onPushToGitHub,
  onImportExternalMarkdownFiles,
  onSelectionChange
}: NoteListProps) {
  const { t } = useTranslation("note");
  const rootRef = useRef<HTMLDivElement>(null);
  const playingNoteIds = useNoteStore((state) => state.playingNoteIds);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragOutSessionRef = useRef<{
    activeNote: Note | null;
    dragOutStarted: boolean;
  }>({
    activeNote: null,
    dragOutStarted: false
  });
  const { isFileDropHover, isImportingExternal, dragHandlers } = useExternalMarkdownDrop({
    onImportExternalMarkdownFiles
  });

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
        onSelectionChange?.({ noteIds: [targetNoteId], anchorId: targetNoteId });
        return;
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = orderedIds.slice(from, to + 1);
      onSelectionChange?.({ noteIds: rangeIds, anchorId });
    },
    [notes, onSelectionChange, selectedNoteId, selectedNoteIds, selectionAnchorId]
  );

  const handleNotePointerDown = useCallback(
    (note: Note, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      if (event.shiftKey || event.metaKey || event.ctrlKey) return;
      if (selectedSet.has(note.id)) return;
      onSelectionChange?.({ noteIds: [note.id], anchorId: note.id });
    },
    [onSelectionChange, selectedSet]
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
        onSelectionChange?.({ noteIds: nextSelected, anchorId: note.id });
        event.preventDefault();
        return;
      }

      onSelectionChange?.({ noteIds: [note.id], anchorId: note.id });
      onSelectNote?.(note.id);
    },
    [handleSelectRange, notes, onSelectNote, onSelectionChange, selectedNoteId, selectedNoteIds]
  );

  const handleNoteContextMenu = useCallback(
    (note: Note) => {
      onSelectionChange?.({ noteIds: selectedSet.has(note.id) ? selectedNoteIds : [note.id], anchorId: note.id });
    },
    [onSelectionChange, selectedNoteIds, selectedSet]
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onSelectionChange?.({ noteIds: [], anchorId: null });
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onSelectionChange]);

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (selectedNoteIds.length === 0) return;
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      const targetElement = event.target instanceof Element ? event.target : null;
      const isContextMenuInteraction = !!targetElement?.closest('[data-slot^="context-menu"]');
      if (isContextMenuInteraction) return;
      if (target && root.contains(target)) {
        const isClickingNoteItem = !!targetElement?.closest('[data-note-item="true"]');
        if (isClickingNoteItem) return;
      }
      onSelectionChange?.({ noteIds: [], anchorId: null });
    };

    document.addEventListener("mousedown", handleDocumentMouseDown, true);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown, true);
  }, [onSelectionChange, selectedNoteIds.length]);

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
      className="relative flex h-full flex-col"
      onDragEnter={dragHandlers.onDragEnter}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
    >
      {/* 外部文件拖入时的提示遮罩：作为面板内部子元素，
          会自动跟随面板的位置 / 尺寸变化，无需手动同步坐标 */}
      <DropHoverMask visible={isFileDropHover} bottomGapPx={8} />

      <div className="flex h-12 shrink-0 items-center justify-end gap-2 px-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label={t("createFromUrl")}
          onClick={onCreateFromUrl}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          aria-label={t("newNote")}
          onClick={onCreateNote}
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>

      {/* 笔记列表 */}
      <div
        className={cn(
          "relative flex-1 overflow-hidden transition-colors duration-200",
          isImportingExternal && "pointer-events-none opacity-80"
        )}
      >
        {isImportingExternal && (
          <div className="border-divider bg-background/80 text-muted-foreground absolute top-2 right-2 left-2 z-10 rounded-md border px-2 py-1 text-center text-xs backdrop-blur-sm">
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
              <p className="text-sm font-medium">{t("emptyState.noNotes")}</p>
              <p className="text-tertiary-foreground mt-1 text-xs">{t("emptyState.createOrSelect")}</p>
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
                          <ContextMenuItem onClick={() => void onDuplicateNotes?.(contextSelectedIds)}>
                            <Copy className="h-4 w-4" />
                            <span>{t("contextMenu.duplicateSelected", { count: contextSelectedCount })}</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => void onCopyNotesRelativePaths?.(contextSelectedIds)}>
                            <ListTree className="h-4 w-4" />
                            <span>{t("contextMenu.copyRelativePathSelected", { count: contextSelectedCount })}</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => void onCopyNotesAbsolutePaths?.(contextSelectedIds)}>
                            <HardDrive className="h-4 w-4" />
                            <span>{t("contextMenu.copyAbsolutePathSelected", { count: contextSelectedCount })}</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator />
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
                          <ContextMenuItem onClick={() => void onCopyNoteRelativePath?.(note)}>
                            <ListTree className="h-4 w-4" />
                            <span>{t("contextMenu.copyRelativePath")}</span>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => void onCopyNoteAbsolutePath?.(note)}>
                            <HardDrive className="h-4 w-4" />
                            <span>{t("contextMenu.copyAbsolutePath")}</span>
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
