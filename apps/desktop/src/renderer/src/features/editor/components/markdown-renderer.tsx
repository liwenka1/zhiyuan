import { useEffect, useRef, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import "highlight.js/styles/github.css";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import { createUrlTransformer, normalizeMarkdownPaths } from "@/lib/resource-resolver";
import { stripHiddenFrontmatter } from "@/lib/frontmatter";
import { markdownSanitizeSchema } from "@/lib/markdown-sanitize-config";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNoteStore, useThemeStore } from "@/stores";
import { shellIpc } from "@/ipc";

// 初始化 mermaid（securityLevel: "strict" 防止 XSS）
mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });

interface MarkdownRendererProps {
  content: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
  noteId?: string;
  className?: string; // 自定义 prose 容器样式
  showEmptyState?: boolean; // 是否显示空状态，默认 true
  emptyStateMessage?: string; // 自定义空状态文案
}

// Mermaid 代码块组件
function MermaidBlock({ code, isDark }: { code: string; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "strict"
      });

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid.render(id, code).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    }
  }, [code, isDark]);

  return <div ref={ref} className="mermaid flex justify-center" />;
}

/**
 * Markdown 渲染器组件
 *
 * 功能：
 * - ✅ 渲染 Markdown 为 HTML
 * - ✅ 支持 GitHub 风格 Markdown (GFM)
 * - ✅ 支持换行 (remarkBreaks)
 * - ✅ 支持 HTML 标签
 * - ✅ 支持代码高亮 (highlight.js)
 * - ✅ 支持数学公式 (KaTeX)
 * - ✅ 支持图表 (Mermaid)
 * - ✅ 支持相对路径资源解析
 * - ✅ 支持外部链接在系统浏览器中打开
 * - ✅ 支持本地文件链接在系统默认程序中打开
 * - ✅ 支持空状态显示
 */
export function MarkdownRenderer({
  content,
  notePath,
  noteId,
  className,
  showEmptyState = true,
  emptyStateMessage
}: MarkdownRendererProps) {
  const { t } = useTranslation("editor");
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";
  const normalizedContent = normalizeMarkdownPaths(stripHiddenFrontmatter(content));

  // 创建 URL 转换函数，将相对路径转换为绝对路径
  const urlTransform = createUrlTransformer(notePath);

  useEffect(() => {
    if (!noteId) return;
    const root = document.getElementById(`preview-scroll-area-${noteId}`);
    if (!root) return;

    const mediaElements = Array.from(root.querySelectorAll("audio, video"));
    if (mediaElements.length === 0) return;

    const handlePlay = () => {
      useNoteStore.getState().setNotePlaying(noteId, true);
    };
    const handleStop = () => {
      useNoteStore.getState().setNotePlaying(noteId, false);
    };

    mediaElements.forEach((el) => {
      el.addEventListener("play", handlePlay);
      el.addEventListener("pause", handleStop);
      el.addEventListener("ended", handleStop);
    });

    return () => {
      mediaElements.forEach((el) => {
        el.removeEventListener("play", handlePlay);
        el.removeEventListener("pause", handleStop);
        el.removeEventListener("ended", handleStop);
      });
    };
  }, [noteId, normalizedContent]);

  // 空内容处理
  if (!normalizedContent && showEmptyState) {
    return (
      <div className={cn("prose dark:prose-invert", className)}>
        <div className="text-muted-foreground mt-8 text-center">{emptyStateMessage || t("previewEmpty")}</div>
      </div>
    );
  }

  return (
    <div className={cn("prose dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, markdownSanitizeSchema], // 安全过滤：移除恶意脚本，保留安全的 HTML
          rehypeSlug,
          [rehypeHighlight, { detect: true }], // 代码语法高亮，与导出保持一致
          rehypeKatex
        ]}
        urlTransform={urlTransform}
        components={{
          pre({ children, ...props }) {
            const child = Array.isArray(children) ? children[0] : children;
            if (isValidElement(child)) {
              const className =
                typeof (child as React.ReactElement<{ className?: string }>).props?.className === "string"
                  ? (child as React.ReactElement<{ className?: string }>).props.className
                  : "";
              if ((className || "").includes("mermaid")) {
                return <div className="mermaid-block">{children}</div>;
              }
            }
            return <pre {...props}>{children}</pre>;
          },
          code({ className, children }) {
            const match = /language-mermaid/.exec(className || "");
            if (match) {
              return <MermaidBlock code={String(children).trim()} isDark={isDark} />;
            }
            return <code className={className}>{children}</code>;
          },
          img({ src, alt, ...props }) {
            // 图片懒加载：只在滚动到可见区域时才加载
            return <img src={src} alt={alt} loading="lazy" {...props} />;
          },
          a({ href, children, ...props }) {
            const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
              if (!href) return;

              // 外部链接，在系统浏览器中打开
              if (href.startsWith("http://") || href.startsWith("https://")) {
                e.preventDefault();
                try {
                  await shellIpc.openExternal(href);
                } catch {
                  toast.error(t("errors.openExternalFailed"));
                }
                return;
              }

              // 本地文件链接（local-resource:// 协议），用系统默认程序打开
              if (href.startsWith("local-resource://")) {
                e.preventDefault();
                // 从 local-resource:// URL 中提取本地路径，需要解码 URL 编码的字符
                const localPath = decodeURIComponent(href.replace("local-resource://", ""));
                try {
                  await shellIpc.openPath(localPath);
                } catch {
                  toast.error(t("errors.openLocalFileFailed"));
                }
                return;
              }
            };
            return (
              <a href={href} onClick={handleClick} {...props}>
                {children}
              </a>
            );
          }
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
