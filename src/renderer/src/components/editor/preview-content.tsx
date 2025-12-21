import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import "@/assets/styles/preview.css";
import { useTranslation } from "react-i18next";

interface PreviewContentProps {
  content: string;
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
export function PreviewContent({ content }: PreviewContentProps) {
  const { t } = useTranslation("editor");

  return (
    <ScrollArea className="h-full">
      <div className="prose prose-slate dark:prose-invert max-w-none" style={{ padding: "var(--editor-padding)" }}>
        {content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {content}
          </ReactMarkdown>
        ) : (
          <div className="text-muted-foreground mt-8 text-center">{t("previewEmpty")}</div>
        )}
      </div>
    </ScrollArea>
  );
}
