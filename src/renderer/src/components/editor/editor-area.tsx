import { useState } from "react";
import { Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

type EditorMode = "edit" | "preview";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
}

export function EditorArea({ content = "", onChange }: EditorAreaProps) {
  const [mode, setMode] = useState<EditorMode>("edit");

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="border-border flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === "edit" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("edit")}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            编辑
          </Button>
          <Button
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("preview")}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            预览
          </Button>
        </div>
      </div>

      {/* 编辑区域 - 后续会根据 mode 切换为独立的编辑/预览组件 */}
      <div className="flex-1 overflow-hidden">
        <textarea
          className="bg-background text-foreground h-full w-full resize-none p-4 font-mono text-sm leading-relaxed outline-none"
          value={content}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="开始编写你的笔记..."
        />
      </div>
    </div>
  );
}
