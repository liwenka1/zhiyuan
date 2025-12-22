import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./preview-content";
import { EmptyEditor } from "./empty-state";
import { useViewStore } from "@/stores/use-view-store";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
  hasNote?: boolean;
  fileName?: string;
  noteId?: string;
}

export function EditorArea({ content = "", onChange, hasNote = false, fileName, noteId }: EditorAreaProps) {
  const editorMode = useViewStore((state) => state.editorMode);

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

  // 根据编辑器模式渲染不同内容
  return (
    <div className="flex h-full flex-col">
      <EditorToolbar fileName={fileName} content={content} />
      <div className="flex-1 overflow-hidden">
        {editorMode === "edit" && <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />}
        {editorMode === "preview" && <PreviewContent content={content} />}
      </div>
    </div>
  );
}
