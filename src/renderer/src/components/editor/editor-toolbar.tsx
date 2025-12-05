import { Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorMode } from "./types";

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
}

export function EditorToolbar({ mode, onModeChange }: EditorToolbarProps) {
  return (
    <div className="border-border flex h-12 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "edit" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange("edit")}
          className="gap-2"
        >
          <Edit className="h-4 w-4" />
          编辑
        </Button>
        <Button
          variant={mode === "preview" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onModeChange("preview")}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          预览
        </Button>
      </div>
    </div>
  );
}
