import { FileText } from "lucide-react";

interface Note {
  id: string;
  title: string;
  updatedAt?: string;
}

interface NoteListProps {
  notes?: Note[];
  selectedNoteId?: string;
  onSelectNote?: (noteId: string) => void;
}

export function NoteList({ notes = [], selectedNoteId, onSelectNote }: NoteListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 笔记列表标题 */}
      <div className="border-border flex h-12 items-center border-b px-4">
        <h2 className="text-foreground text-sm font-semibold">笔记</h2>
      </div>

      {/* 笔记列表 */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-4 text-sm">
            <FileText className="mb-2 h-8 w-8 opacity-50" />
            <p>暂无笔记</p>
            <p className="mt-1 text-xs">选择一个文件夹查看笔记</p>
          </div>
        ) : (
          <div className="p-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`cursor-pointer rounded-md px-3 py-2 transition-colors ${
                  selectedNoteId === note.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
                onClick={() => onSelectNote?.(note.id)}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    {note.updatedAt && <p className="text-muted-foreground mt-0.5 text-xs">{note.updatedAt}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
