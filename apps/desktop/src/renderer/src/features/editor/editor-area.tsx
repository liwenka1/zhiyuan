import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { PreviewContent } from "./components";
import { EmptyEditor } from "./empty-state";
import { useViewStore } from "@/stores";

interface EditorAreaProps {
  content?: string;
  onChange?: (content: string) => void;
  hasNote?: boolean;
  noteId?: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
}

export function EditorArea({ content = "", onChange, hasNote = false, noteId, notePath }: EditorAreaProps) {
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
      <EditorToolbar content={content} />
      <div className="flex-1 overflow-hidden">
        {editorMode === "edit" && <EditorContent content={content} onChange={handleContentChange} noteId={noteId} />}
        {editorMode === "preview" && <PreviewContent content={content} notePath={notePath} />}
      </div>
    </div>
  );
}
