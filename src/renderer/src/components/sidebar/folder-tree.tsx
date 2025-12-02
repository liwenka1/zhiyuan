import { Folder } from "lucide-react";

interface FolderItem {
  id: string;
  name: string;
}

interface FolderTreeProps {
  folders?: FolderItem[];
  selectedFolderId?: string;
  onSelectFolder?: (folderId: string) => void;
}

export function FolderTree({ folders = [], selectedFolderId, onSelectFolder }: FolderTreeProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 文件夹列表标题 */}
      <div className="border-border flex h-12 items-center border-b px-4">
        <h2 className="text-foreground text-sm font-semibold">文件夹</h2>
      </div>

      {/* 文件夹列表 */}
      <div className="flex-1 overflow-y-auto">
        {folders.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-4 text-sm">
            <Folder className="mb-2 h-8 w-8 opacity-50" />
            <p>暂无文件夹</p>
          </div>
        ) : (
          <div className="p-2">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  selectedFolderId === folder.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
                onClick={() => onSelectFolder?.(folder.id)}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">{folder.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
