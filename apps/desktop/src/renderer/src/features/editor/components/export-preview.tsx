import { useEffect, useMemo, useRef, useState } from "react";
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
  const previewSession = useMemo(() => Symbol(previewDoc ? "export-preview" : "empty-export-preview"), [previewDoc]);
  const [readySession, setReadySession] = useState<symbol | null>(null);
  const [measuredSession, setMeasuredSession] = useState<symbol | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const isReady = readySession === previewSession;
  const hasMeasured = measuredSession === previewSession;
  const currentIframeHeight = isReady ? iframeHeight : 0;

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [previewDoc]);

  // 清理 ResizeObserver
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  // 同步 iframe 高度
  const handleIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const currentPreviewSession = previewSession;

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
    if (readySession !== currentPreviewSession) {
      setReadySession(currentPreviewSession);
    }
    if (measuredSession !== currentPreviewSession) {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = window.requestAnimationFrame(() => {
        setMeasuredSession(currentPreviewSession);
        animationFrameRef.current = null;
      });
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
              height: `${currentIframeHeight}px`,
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
