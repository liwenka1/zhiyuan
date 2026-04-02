import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ExportPreviewProps {
  previewDoc: string;
  isRendering: boolean;
  isActive: boolean;
}

/**
 * 导出预览组件 - 使用 iframe 渲染完整的导出 HTML
 * 包含完整的导出样式、主题和布局配置
 */
export function ExportPreview({ previewDoc, isRendering, isActive }: ExportPreviewProps) {
  const { t } = useTranslation("editor");
  const [iframeHeight, setIframeHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    setIsReady(false);
    setHasMeasured(false);
    setIframeHeight(0);
  }, [previewDoc]);

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
    if (!hasMeasured) {
      setIsReady(true);
      window.requestAnimationFrame(() => setHasMeasured(true));
    }
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
      <div className="relative min-h-55 overflow-hidden">
        {previewDoc ? (
          <iframe
            ref={iframeRef}
            title="export-preview"
            srcDoc={previewDoc}
            onLoad={handleIframeLoad}
            className="w-full border-0 bg-transparent"
            style={{
              height: `${iframeHeight}px`,
              transition: hasMeasured ? "height 200ms ease-out" : "none",
              visibility: isReady ? "visible" : "hidden"
            }}
            sandbox="allow-same-origin allow-scripts"
            scrolling="no"
          />
        ) : null}
        {isActive && (isRendering || (previewDoc && !isReady)) && (
          <div className="bg-background/80 text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
            {t("toolbar.exportPreviewOpening")}
          </div>
        )}
      </div>
    </div>
  );
}
