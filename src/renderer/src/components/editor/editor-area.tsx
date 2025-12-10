import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { EmptyEditor } from "./empty-state";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
  hasNote?: boolean;
}

export function EditorArea({ content = "", onChange, hasNote = false }: EditorAreaProps) {
  const handleContentChange = (value: string) => {
    onChange?.(value);
  };

  // 如果没有选中笔记，显示空状态
  if (!hasNote && !content) {
    return (
      <div className="flex h-full flex-col">
        <EditorToolbar />
        <div className="flex-1">
          <EmptyEditor />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar />
      <div className="flex-1 overflow-hidden">
        <EditorContent content={content} onChange={handleContentChange} />
      </div>
    </div>
  );
}
