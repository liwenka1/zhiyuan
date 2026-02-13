import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "./markdown-renderer";
import { useExportLayoutStore, useExportThemeStore, useViewStore } from "@/stores";
import { renderNoteExportPreviewHtml } from "@/features/export/lib";
import { useTranslation } from "react-i18next";

interface PreviewContentProps {
  content: string;
  notePath?: string; // 笔记的完整文件路径，用于解析相对资源路径
  noteId?: string;
  noteTitle?: string;
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
export function PreviewContent({ content, notePath, noteId, noteTitle }: PreviewContentProps) {
  const { t } = useTranslation("editor");
  const exportPreview = useViewStore((state) => state.previewConfig.exportPreview);
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [previewDoc, setPreviewDoc] = useState<string>("");
  const [isRendering, setIsRendering] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(480);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!exportPreview) return;

    const timer = window.setTimeout(async () => {
      setIsRendering(true);
      try {
        const html = await renderNoteExportPreviewHtml({
          title: noteTitle || t("toolbar.exportPreview"),
          markdown: content,
          themeId: exportThemeId,
          layout: exportLayout,
          notePath
        });
        setPreviewDoc(html);
      } finally {
        setIsRendering(false);
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [content, exportLayout, exportPreview, exportThemeId, noteTitle, notePath, t]);

  useEffect(() => {
    if (exportPreview) return;
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, [exportPreview]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const syncHeight = () => {
      const shell = doc.querySelector(".export-layout-shell") as HTMLElement | null;
      const contentHeight = shell?.offsetHeight ?? 0;
      const bodyStyle = doc.defaultView?.getComputedStyle(doc.body ?? doc.documentElement);
      const bodyPaddingTop = Number.parseFloat(bodyStyle?.paddingTop ?? "0") || 0;
      const bodyPaddingBottom = Number.parseFloat(bodyStyle?.paddingBottom ?? "0") || 0;
      const measured = contentHeight > 0 ? contentHeight + bodyPaddingTop + bodyPaddingBottom : 0;
      const fallback = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      setIframeHeight(Math.max(320, measured || fallback));
    };

    syncHeight();
    observerRef.current?.disconnect();
    const nextObserver = new ResizeObserver(syncHeight);
    nextObserver.observe(doc.documentElement);
    if (doc.body) {
      nextObserver.observe(doc.body);
    }
    observerRef.current = nextObserver;
  };

  return (
    <ScrollArea className="h-full" id={noteId ? `preview-scroll-area-${noteId}` : "preview-scroll-area"}>
      <div style={{ padding: "0 var(--editor-padding) var(--editor-bottom-space) var(--editor-padding)" }}>
        {exportPreview ? (
          <div className="relative min-h-[220px] overflow-hidden border">
            <iframe
              ref={iframeRef}
              title="export-preview"
              srcDoc={previewDoc}
              onLoad={handleIframeLoad}
              className="w-full border-0 bg-transparent"
              style={{ height: `${iframeHeight}px`, transition: "height 200ms ease-out" }}
              sandbox="allow-same-origin allow-scripts"
              scrolling="no"
            />
            {isRendering && (
              <div className="bg-background/80 text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
                {t("toolbar.exportPreviewOpening")}
              </div>
            )}
          </div>
        ) : (
          <MarkdownRenderer content={content} notePath={notePath} noteId={noteId} className="max-w-none" />
        )}
      </div>
    </ScrollArea>
  );
}
