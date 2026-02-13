import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useExportLayoutStore, useExportThemeStore } from "@/stores";
import { renderNoteExportPreviewHtml } from "@/features/export/lib";

interface ExportPreviewProps {
  content: string;
  notePath?: string;
  noteTitle?: string;
}

/**
 * 导出预览组件 - 使用 iframe 渲染完整的导出 HTML
 * 包含完整的导出样式、主题和布局配置
 */
export function ExportPreview({ content, notePath, noteTitle }: ExportPreviewProps) {
  const { t } = useTranslation("editor");
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [previewDoc, setPreviewDoc] = useState<string>("");
  const [isRendering, setIsRendering] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(480);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // 生成导出预览 HTML
  useEffect(() => {
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
  }, [content, exportLayout, exportThemeId, noteTitle, notePath, t]);

  // 清理 ResizeObserver
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  // 同步 iframe 高度
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
    <div style={{ padding: "0 0 var(--editor-bottom-space) 0" }}>
      <div className="relative min-h-[220px] overflow-hidden">
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
    </div>
  );
}
