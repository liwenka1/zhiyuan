import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ThemeColors } from "@/features/export/lib/styles";
import type { ExportLayoutConfig } from "@shared";
import { buildExportPreviewLayout } from "./export-preview-layout";
import { ExportPreviewArticle } from "./export-preview-article";

export const ExportThemePreview = memo(function ExportThemePreview({
  colors,
  layout
}: {
  colors: ThemeColors;
  layout?: Partial<ExportLayoutConfig>;
}) {
  const PREVIEW_FRAME_HEIGHT = 320;
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const { baseFontSize, contentWidth, cardPadding, outerBackground, innerBackground } = buildExportPreviewLayout(
    colors,
    layout
  );

  useEffect(() => {
    const frameEl = frameRef.current;
    const contentEl = contentRef.current;
    if (!frameEl || !contentEl) return;

    const updateFrameWidth = () => setFrameWidth(frameEl.clientWidth);
    const updateContentHeight = () => setContentHeight(contentEl.scrollHeight);
    updateFrameWidth();
    updateContentHeight();

    const frameObserver = new ResizeObserver(updateFrameWidth);
    const contentObserver = new ResizeObserver(updateContentHeight);
    frameObserver.observe(frameEl);
    contentObserver.observe(contentEl);

    return () => {
      frameObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [contentWidth, baseFontSize, cardPadding, colors]);

  const previewScale = useMemo(() => {
    const widthScale = frameWidth > 0 ? frameWidth / contentWidth : 1;
    const heightScale = contentHeight > 0 ? PREVIEW_FRAME_HEIGHT / contentHeight : 1;
    return Math.max(0.25, Math.min(1, widthScale, heightScale));
  }, [frameWidth, contentWidth, contentHeight]);

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: outerBackground, overflowAnchor: "none" }}>
      <div
        ref={frameRef}
        className="relative mx-auto w-full overflow-hidden rounded-xl"
        style={{ height: `${PREVIEW_FRAME_HEIGHT}px` }}
      >
        <div
          className="absolute top-0 left-1/2"
          style={{
            width: `${contentWidth}px`,
            transform: `translateX(-50%) scale(${previewScale})`,
            transformOrigin: "top center",
            willChange: "transform"
          }}
        >
          <div
            ref={contentRef}
            className="overflow-hidden rounded-xl text-left"
            style={{
              backgroundColor: innerBackground,
              border: `1px solid ${colors.border}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)"
            }}
          >
            <ExportPreviewArticle colors={colors} baseFontSize={baseFontSize} cardPadding={cardPadding} />
          </div>
        </div>
      </div>
    </div>
  );
});
