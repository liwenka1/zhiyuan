import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportPreview } from "./export-preview";
import { MarkdownPreview } from "./markdown-preview";
import { useViewStore } from "@/stores";

interface PreviewContentProps {
  content: string;
  notePath?: string;
  noteId?: string;
  noteTitle?: string;
}

/**
 * 预览内容容器组件
 * 根据当前模式分发到不同的预览实现：
 * - 导出预览模式：使用 ExportPreview（iframe 渲染完整导出样式）
 * - 普通预览模式：使用 MarkdownPreview（直接渲染 Markdown）
 */
export function PreviewContent({ content, notePath, noteId, noteTitle }: PreviewContentProps) {
  const exportPreview = useViewStore((state) => state.previewConfig.exportPreview);

  return (
    <ScrollArea className="h-full" id={noteId ? `preview-scroll-area-${noteId}` : "preview-scroll-area"}>
      {exportPreview ? (
        <ExportPreview content={content} notePath={notePath} noteTitle={noteTitle} />
      ) : (
        <MarkdownPreview content={content} notePath={notePath} noteId={noteId} />
      )}
    </ScrollArea>
  );
}
