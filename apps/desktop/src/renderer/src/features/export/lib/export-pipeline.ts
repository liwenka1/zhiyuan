import { markdownToHTML } from "@/lib/markdown-processor";
import { normalizeMarkdownPaths } from "@/lib/markdown-links";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
import { generateWechatHTMLDocument } from "@/lib/wechat-html";
import { useWorkspaceStore } from "@/stores/use-workspace-store";
import type { Note } from "@/types";
import type { ExportLayoutConfig } from "@shared";

export type ExportFormat = "html" | "pdf" | "image";

interface BuildFromMarkdownOptions {
  title: string;
  markdown: string;
  format: ExportFormat;
  themeId: string;
  layout?: Partial<ExportLayoutConfig>;
  notePath?: string;
  isDarkTheme?: boolean;
}

export async function buildExportDocument(
  note: Note,
  format: ExportFormat,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<string> {
  return buildExportDocumentFromMarkdown({
    title: note.title,
    markdown: note.content,
    format,
    themeId,
    layout,
    notePath: note.filePath
  });
}

export async function buildExportDocumentsBySections(
  note: Note,
  format: ExportFormat,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<string[]> {
  const markdown = normalizeMarkdownPaths(note.content, useWorkspaceStore.getState().workspacePath);
  const sections = splitMarkdownByHr(markdown);
  if (sections.length === 0) {
    throw new Error("没有内容可导出");
  }

  return Promise.all(
    sections.map(async (section) => {
      return buildExportDocumentFromMarkdown({
        title: note.title,
        markdown: section,
        format,
        themeId,
        layout,
        notePath: note.filePath
      });
    })
  );
}

export async function buildExportDocumentFromMarkdown(options: BuildFromMarkdownOptions): Promise<string> {
  const htmlBody = await markdownToHTML(options.markdown, {
    notePath: options.notePath,
    workspacePath: useWorkspaceStore.getState().workspacePath,
    isDarkTheme: options.isDarkTheme,
    enableCopyButton: false
  });

  return generateHTMLDocument(options.title, htmlBody, {
    themeId: options.themeId,
    format: options.format,
    layout: options.layout
  });
}

export async function buildWechatDocument(
  note: Note,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<string> {
  const htmlBody = await markdownToHTML(note.content, {
    notePath: note.filePath,
    workspacePath: useWorkspaceStore.getState().workspacePath,
    enableCopyButton: false
  });
  return generateWechatHTMLDocument(note.title, htmlBody, themeId, layout);
}
