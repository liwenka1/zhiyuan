import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import "@/assets/styles/preview.css";
import { useTranslation } from "react-i18next";
import { createUrlTransformer } from "@/lib/resource-resolver";

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
 * - TODO: 支持代码高亮
 * - TODO: 支持数学公式
 * - TODO: 支持图表
 */
export function PreviewContent({ content, notePath }: PreviewContentProps) {
  const { t } = useTranslation("editor");

  // 创建 URL 转换函数，将相对路径转换为绝对路径
  const urlTransform = createUrlTransformer(notePath);

  return (
    <ScrollArea className="h-full" id="preview-scroll-area">
      <div className="prose prose-slate dark:prose-invert max-w-none" style={{ padding: "var(--editor-padding)" }}>
        {content ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSlug]}
            urlTransform={urlTransform}
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
