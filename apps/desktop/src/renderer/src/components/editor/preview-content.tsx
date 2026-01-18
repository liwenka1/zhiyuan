import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import "highlight.js/styles/github.css";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "@/assets/styles/preview.css";
import { useTranslation } from "react-i18next";
import { createUrlTransformer } from "@/lib/resource-resolver";

// 初始化 mermaid
mermaid.initialize({ startOnLoad: false, theme: "default" });

interface PreviewContentProps {
  content: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
}

// Mermaid 代码块组件
function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid.render(id, code).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    }
  }, [code]);

  return <div ref={ref} className="mermaid flex justify-center" />;
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
  const { t } = useTranslation("editor");

  // 创建 URL 转换函数，将相对路径转换为绝对路径
  const urlTransform = createUrlTransformer(notePath);

  return (
    <ScrollArea className="h-full" id="preview-scroll-area">
      <div
        className="prose prose-slate dark:prose-invert max-w-none"
        style={{ padding: "0 var(--editor-padding) var(--editor-padding) var(--editor-padding)" }}
      >
        {content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight, rehypeKatex]}
            urlTransform={urlTransform}
            components={{
              code({ className, children }) {
                const match = /language-mermaid/.exec(className || "");
                if (match) {
                  return <MermaidBlock code={String(children).trim()} />;
                }
                return <code className={className}>{children}</code>;
              }
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <div className="text-muted-foreground mt-8 text-center">{t("previewEmpty")}</div>
        )}
      </div>
    </ScrollArea>
  );
}
