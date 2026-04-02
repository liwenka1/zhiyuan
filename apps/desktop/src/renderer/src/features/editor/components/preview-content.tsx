import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportPreview } from "./export-preview";
import { MarkdownPreview } from "./markdown-preview";
import { renderNoteExportPreviewHtml } from "@/features/export/lib";
import { useExportLayoutStore, useExportThemeStore, useViewStore } from "@/stores";

interface PreviewContentProps {
  content: string;
  notePath?: string;
  noteId?: string;
  noteTitle?: string;
}

/**
 * 预览内容容器组件
 * 根据当前模式分发到不同的预览实现：
 * - 导出预览模式：使用 ExportPreview（iframe 渲染完整导出样式）
 * - 普通预览模式：使用 MarkdownPreview（直接渲染 Markdown）
 */
export function PreviewContent({ content, notePath, noteId, noteTitle }: PreviewContentProps) {
  const { t } = useTranslation("editor");
  const exportPreview = useViewStore((state) => state.previewConfig.exportPreview);
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [shouldRenderExportPreview, setShouldRenderExportPreview] = useState(exportPreview);
  const [exportPreviewDoc, setExportPreviewDoc] = useState("");
  const [isPreparingExportPreview, setIsPreparingExportPreview] = useState(false);
  const renderVersionRef = useRef(0);

  useEffect(() => {
    if (exportPreview) {
      setShouldRenderExportPreview(true);
    }
  }, [exportPreview]);

  useEffect(() => {
    if (!shouldRenderExportPreview) return;

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      const version = renderVersionRef.current + 1;
      renderVersionRef.current = version;
      setIsPreparingExportPreview(true);

      try {
        const html = await renderNoteExportPreviewHtml({
          title: noteTitle || t("toolbar.exportPreview"),
          markdown: content,
          themeId: exportThemeId,
          layout: exportLayout,
          notePath
        });

        if (!isCancelled && renderVersionRef.current === version) {
          setExportPreviewDoc(html);
        }
      } finally {
        if (!isCancelled && renderVersionRef.current === version) {
          setIsPreparingExportPreview(false);
        }
      }
    }, 120);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, exportLayout, exportThemeId, notePath, noteTitle, shouldRenderExportPreview, t]);

  return (
    <ScrollArea className="h-full" id={noteId ? `preview-scroll-area-${noteId}` : "preview-scroll-area"}>
      <div style={{ display: exportPreview ? "none" : "block" }}>
        <MarkdownPreview content={content} notePath={notePath} noteId={noteId} />
      </div>

      {shouldRenderExportPreview ? (
        <div
          aria-hidden={!exportPreview}
          style={
            exportPreview
              ? undefined
              : {
                  height: 0,
                  overflow: "hidden",
                  opacity: 0,
                  pointerEvents: "none"
                }
          }
        >
          <ExportPreview
            previewDoc={exportPreviewDoc}
            isRendering={isPreparingExportPreview}
            isActive={exportPreview}
          />
        </div>
      ) : null}
    </ScrollArea>
  );
}
