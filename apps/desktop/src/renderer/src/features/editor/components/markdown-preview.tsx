import { MarkdownRenderer } from "./markdown-renderer";

interface MarkdownPreviewProps {
  content: string;
  notePath?: string;
  noteId?: string;
}

/**
 * Markdown 预览组件 - 直接渲染 Markdown 内容
 * 不包含导出样式，仅用于普通预览模式
 */
export function MarkdownPreview({ content, notePath, noteId }: MarkdownPreviewProps) {
  return (
    <div style={{ padding: "0 var(--editor-padding) var(--editor-bottom-space) var(--editor-padding)" }}>
      <MarkdownRenderer content={content} notePath={notePath} noteId={noteId} className="max-w-none" />
    </div>
  );
}
