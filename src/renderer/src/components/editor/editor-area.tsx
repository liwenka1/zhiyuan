import { useState } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import type { EditorMode } from "./types";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
}

export function EditorArea({ content = "", onChange }: EditorAreaProps) {
  const [mode, setMode] = useState<EditorMode>("edit");

  const handleContentChange = (value: string) => {
    onChange?.(value);
  };

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar mode={mode} onModeChange={setMode} />
      <EditorContent content={content} onChange={handleContentChange} />
    </div>
  );
}
