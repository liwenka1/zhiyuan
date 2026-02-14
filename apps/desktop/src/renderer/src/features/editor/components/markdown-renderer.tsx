import { useEffect, useMemo, useState } from "react";
import "highlight.js/styles/github.css";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import { decodeLocalResourceUrl } from "@shared";
import { stripHiddenFrontmatter } from "@/lib/frontmatter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNoteStore, useThemeStore } from "@/stores";
import { shellIpc } from "@/ipc";
import { markdownToHTML } from "@/lib/markdown-processor";

interface MarkdownRendererProps {
  content: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
  noteId?: string;
  className?: string; // 自定义 prose 容器样式
  showEmptyState?: boolean; // 是否显示空状态，默认 true
  emptyStateMessage?: string; // 自定义空状态文案
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
  const [htmlContent, setHtmlContent] = useState("");
  const contentForEmpty = useMemo(() => stripHiddenFrontmatter(content), [content]);

  useEffect(() => {
    let isCancelled = false;

    const renderMarkdown = async () => {
      try {
        const html = await markdownToHTML(content, { notePath, isDarkTheme: isDark });
        if (!isCancelled) {
          setHtmlContent(html);
        }
      } catch {
        if (!isCancelled) {
          setHtmlContent("");
        }
      }
    };

    renderMarkdown();

    return () => {
      isCancelled = true;
    };
  }, [content, notePath, isDark]);

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
  }, [noteId, htmlContent]);

  useEffect(() => {
    if (!noteId) return;
    const root = document.getElementById(`preview-scroll-area-${noteId}`);
    if (!root) return;

    const images = Array.from(root.querySelectorAll("img"));
    images.forEach((img) => {
      if (!img.getAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }
    });
  }, [noteId, htmlContent]);

  // 空内容处理
  if (!contentForEmpty.trim() && showEmptyState) {
    return (
      <div className={cn("prose dark:prose-invert", className)}>
        <div className="text-muted-foreground mt-8 text-center">{emptyStateMessage || t("previewEmpty")}</div>
      </div>
    );
  }

  return (
    <div className={cn("prose dark:prose-invert", className)}>
      <div
        onClick={async (e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;
          const anchor = target.closest("a") as HTMLAnchorElement | null;
          if (!anchor) return;

          const href = anchor.getAttribute("href");
          if (!href) return;

          if (href.startsWith("http://") || href.startsWith("https://")) {
            e.preventDefault();
            try {
              await shellIpc.openExternal(href);
            } catch {
              toast.error(t("errors.openExternalFailed"));
            }
            return;
          }

          if (href.startsWith("local-resource://")) {
            e.preventDefault();
            const localPath = decodeLocalResourceUrl(href);
            try {
              await shellIpc.openPath(localPath);
            } catch {
              toast.error(t("errors.openLocalFileFailed"));
            }
          }
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
