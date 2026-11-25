import { useEffect, useMemo, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { decodeLocalResourceUrl } from "@shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNoteStore, useThemeStore } from "@/stores";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
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
 * - ✅ 支持代码高亮 (shiki)
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
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const isDark = theme === "dark";
  const httpImageWarning = t("errors.httpImage");
  const [htmlContent, setHtmlContent] = useState("");
  const renderedHtml = useMemo(() => ({ __html: htmlContent }), [htmlContent]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderMarkdown = async () => {
      try {
        const html = await markdownToHTML(content, {
          notePath,
          workspacePath,
          isDarkTheme: isDark,
          enableCopyButton: true,
          allowExternalMedia: true
        });
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
  }, [content, notePath, workspacePath, isDark]);

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
    const root = contentRef.current;
    if (!root) return;

    const images = Array.from(root.querySelectorAll("img"));
    images.forEach((img) => {
      if (/^http:\/\//i.test(img.getAttribute("src") ?? "")) {
        const placeholder = document.createElement("span");
        placeholder.dataset.httpImageAlt = img.alt;
        img.replaceWith(placeholder);
        return;
      }
      if (!img.getAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }
    });
    for (const placeholder of root.querySelectorAll<HTMLElement>("span[data-http-image-alt]")) {
      const alt = placeholder.dataset.httpImageAlt;
      placeholder.textContent = alt ? `${alt} (${httpImageWarning})` : httpImageWarning;
    }
  }, [htmlContent, httpImageWarning]);

  // 空内容处理
  if (!content.trim() && showEmptyState) {
    return (
      <div className={cn("prose dark:prose-invert", className)}>
        <div className="text-muted-foreground mt-8 text-center">{emptyStateMessage || t("previewEmpty")}</div>
      </div>
    );
  }

  return (
    <div className={cn("prose dark:prose-invert", className)}>
      <div
        ref={contentRef}
        onClick={async (e) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;

          const copyButton = target.closest("[data-code-copy-button]") as HTMLElement | null;
          if (copyButton) {
            const pre = copyButton.closest("pre");
            const code = pre?.querySelector("code");
            const codeText = code?.textContent ?? "";
            if (!codeText.trim()) return;
            try {
              await navigator.clipboard.writeText(codeText);
              toast.success(t("copyCodeSuccess"));
            } catch {
              toast.error(t("errors.copyCodeFailed"));
            }
            return;
          }

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
            if (!e.nativeEvent.isTrusted) return;
            const localPath = decodeLocalResourceUrl(href);
            try {
              await shellIpc.openNoteLink(localPath);
            } catch {
              toast.error(t("errors.openLocalFileFailed"));
            }
          }
        }}
        dangerouslySetInnerHTML={renderedHtml}
      />
    </div>
  );
}
