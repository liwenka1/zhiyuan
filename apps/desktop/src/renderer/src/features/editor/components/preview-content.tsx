import { useEffect, useState } from "react";
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
  isActive?: boolean;
}

/**
 * 预览内容容器组件
 * 根据当前模式分发到不同的预览实现：
 * - 导出预览模式：使用 ExportPreview（iframe 渲染完整导出样式）
 * - 普通预览模式：使用 MarkdownPreview（直接渲染 Markdown）
 */
export function PreviewContent({ content, notePath, noteId, noteTitle, isActive = true }: PreviewContentProps) {
  const { t } = useTranslation("editor");
  const exportPreview = useViewStore((state) => state.previewConfig.exportPreview) && isActive;
  const exportThemeId = useExportThemeStore((state) => state.exportThemeId);
  const exportLayout = useExportLayoutStore((state) => state.exportLayout);
  const [exportPreviewDoc, setExportPreviewDoc] = useState("");
  const [isPreparingExportPreview, setIsPreparingExportPreview] = useState(false);

  useEffect(() => {
    if (!exportPreview) return;

    const controller = new AbortController();
    const { signal } = controller;
    const timer = window.setTimeout(async () => {
      setIsPreparingExportPreview(true);

      try {
        const html = await renderNoteExportPreviewHtml(
          {
            title: noteTitle || t("toolbar.exportPreview"),
            markdown: content,
            themeId: exportThemeId,
            layout: exportLayout,
            notePath
          },
          signal
        );

        if (!signal.aborted) setExportPreviewDoc(html);
      } catch {
        if (!signal.aborted) setExportPreviewDoc("");
      } finally {
        if (!signal.aborted) setIsPreparingExportPreview(false);
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [content, exportLayout, exportThemeId, notePath, noteTitle, exportPreview, t]);

  return (
    <ScrollArea
      className="h-full"
      id={noteId ? `preview-scroll-area-${noteId}` : "preview-scroll-area"}
      viewportRender={(props) => (
        <div
          {...props}
          data-note-preview
          tabIndex={props.tabIndex ?? -1}
          role="region"
          aria-label={noteTitle || t("toolbar.preview")}
        />
      )}
    >
      <div style={{ display: exportPreview ? "none" : "block" }}>
        <MarkdownPreview content={content} notePath={notePath} noteId={noteId} />
      </div>

      {exportPreview || exportPreviewDoc ? (
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
