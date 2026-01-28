import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "./markdown-renderer";

interface PreviewContentProps {
  content: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
}

/**
 * 预览内容组件
 * 功能：
 * - ✅ 渲染 Markdown 为 HTML
 * - ✅ 支持 GitHub 风格 Markdown (GFM)
 * - ✅ 支持 HTML 标签
 * - ✅ 支持代码高亮
 * - ✅ 支持数学公式 (KaTeX)
 * - ✅ 支持图表 (Mermaid)
 */
export function PreviewContent({ content, notePath }: PreviewContentProps) {
  return (
    <ScrollArea className="h-full" id="preview-scroll-area">
      <div style={{ padding: "0 var(--editor-padding) var(--editor-padding) var(--editor-padding)" }}>
        <MarkdownRenderer content={content} notePath={notePath} className="max-w-none" />
      </div>
    </ScrollArea>
  );
}
