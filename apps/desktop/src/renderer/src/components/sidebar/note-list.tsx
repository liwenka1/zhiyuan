import { FileText, Inbox, SquarePen, Pin, Search, Eye, Trash2, Copy, Pencil, Download } from "lucide-react";
import { motion } from "motion/react";
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
import { getSelectionBgColor, getHoverBgColor } from "@/lib/theme";
import { useTranslation } from "react-i18next";

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
  onSearchChange?: (keyword: string) => void;
  onShowNoteInExplorer?: (note: Note) => void;
  onDeleteNote?: (note: Note) => void;
  onRenameNote?: (note: Note) => void;
  onDuplicateNote?: (note: Note) => void;
  onExportNote?: (note: Note, format: "html" | "pdf" | "pdf-pages" | "image" | "image-pages") => void;
  onCopyToWechat?: (note: Note) => void;
}

export function NoteList({
  notes = [],
  selectedNoteId,
  searchKeyword = "",
  onSelectNote,
  onCreateNote,
  onSearchChange,
  onShowNoteInExplorer,
  onDeleteNote,
  onRenameNote,
  onDuplicateNote,
  onExportNote,
  onCopyToWechat
}: NoteListProps) {
  const { t } = useTranslation("note");

  return (
    <div className="flex h-full flex-col">
      {/* 顶部搜索栏 */}
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="search"
            placeholder={t("search")}
            value={searchKeyword}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="bg-muted/50 h-8 border-none pl-8 text-sm focus-visible:ring-1"
          />
        </div>
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
      <ScrollArea className="flex-1 overflow-hidden">
        {notes.length === 0 ? (
          <motion.div
            className="empty-state text-muted-foreground flex flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Inbox className="empty-state-icon mb-3 h-10 w-10" />
            <p className="text-sm font-medium">{searchKeyword ? t("emptyState.noResults") : t("emptyState.noNotes")}</p>
            <p className="text-tertiary-foreground mt-1 text-xs">
              {searchKeyword ? t("emptyState.tryOtherKeywords") : t("emptyState.createOrSelect")}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-0.5 px-2">
            {notes.map((note, index) => {
              const isSelected = selectedNoteId === note.id;
              return (
                <ContextMenu key={note.id}>
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
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="note-item cursor-pointer overflow-hidden rounded-md px-3 py-2"
                      onClick={() => onSelectNote?.(note.id)}
                    >
                      {/* 标题行 */}
                      <div className="flex min-w-0 items-start gap-2">
                        {note.isPinned ? (
                          <Pin
                            className={cn(
                              "mt-0.5 h-3.5 w-3.5 shrink-0",
                              isSelected ? "text-highlight" : "text-highlight/70"
                            )}
                          />
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
                        <p
                          className={cn(
                            "mt-1.5 text-xs",
                            isSelected ? "text-muted-foreground" : "text-muted-foreground/80"
                          )}
                        >
                          {formatDateTime(note.updatedAt)}
                        </p>
                      )}
                    </motion.div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onShowNoteInExplorer?.(note)}>
                      <Eye className="h-4 w-4" />
                      <span>{t("contextMenu.showInExplorer")}</span>
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
