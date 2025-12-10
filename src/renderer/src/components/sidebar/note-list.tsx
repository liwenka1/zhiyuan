import { FileText, Inbox, Pin, Plus, Search } from "lucide-react";
import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  updatedAt?: string;
  isPinned?: boolean;
}

interface NoteListProps {
  notes?: Note[];
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
}

export function NoteList({ notes = [], selectedNoteId, onSelectNote }: NoteListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 顶部搜索栏 */}
      <div className="border-divider flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            type="search"
            placeholder="搜索笔记..."
            className="bg-muted/50 h-8 border-none pl-8 text-sm focus-visible:ring-1"
          />
        </div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" aria-label="新建笔记">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>新建笔记</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 笔记列表 */}
      <ScrollArea className="flex-1">
        {notes.length === 0 ? (
          <motion.div
            className="empty-state text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Inbox className="empty-state-icon mb-3 h-10 w-10" />
            <p className="text-sm font-medium">暂无笔记</p>
            <p className="text-tertiary-foreground mt-1 text-xs">选择文件夹或创建新笔记</p>
          </motion.div>
        ) : (
          <div className="space-y-0.5 p-2">
            {notes.map((note, index) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                whileHover={{ backgroundColor: "hsl(var(--muted))" }}
                className={cn(
                  "note-item cursor-pointer rounded-md px-3 py-3",
                  selectedNoteId === note.id ? "bg-selection" : ""
                )}
                onClick={() => onSelectNote?.(note.id)}
              >
                {/* 标题行 */}
                <div className="flex items-start gap-2">
                  {note.isPinned ? (
                    <Pin className="text-highlight mt-0.5 h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <FileText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  )}
                  <h3 className="text-foreground truncate-text flex-1 text-sm leading-tight font-medium">
                    {note.title}
                  </h3>
                </div>

                {/* 日期行 */}
                {note.updatedAt && (
                  <p className="text-muted-foreground mt-1.5 pl-[22px] text-[11px]">{note.updatedAt}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
