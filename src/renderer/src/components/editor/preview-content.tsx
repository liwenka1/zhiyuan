import { ScrollArea } from "@/components/ui/scroll-area";

interface PreviewContentProps {
  content: string;
}

/**
 * 预览内容组件
 * 功能：
 * - 渲染 Markdown 为 HTML
 * - 支持语法高亮
 * - 支持数学公式
 * - 支持图表
 *
 * TODO: 实现具体功能
 * 1. 安装 react-markdown 或 marked
 * 2. 配置 Markdown 解析器
 * 3. 添加代码高亮（prism/highlight.js）
 * 4. 添加数学公式支持（KaTeX）
 * 5. 应用样式（GitHub/Typora 风格）
 */
export function PreviewContent({ content }: PreviewContentProps) {
  return (
    <ScrollArea className="h-full">
      <div className="prose prose-slate dark:prose-invert max-w-none" style={{ padding: "var(--editor-padding)" }}>
        {/* 临时占位：显示纯文本 */}
        <div className="font-mono text-sm whitespace-pre-wrap">{content || "暂无内容"}</div>
      </div>
    </ScrollArea>
  );
}
