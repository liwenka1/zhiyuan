import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
import { generateWechatHTMLDocument } from "@/lib/wechat-html";
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
    layout
  });
}

export async function buildExportDocumentsBySections(
  note: Note,
  format: ExportFormat,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<string[]> {
  const sections = splitMarkdownByHr(note.content);
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
        layout
      });
    })
  );
}

export async function buildExportDocumentFromMarkdown(options: BuildFromMarkdownOptions): Promise<string> {
  const htmlBody = await markdownToHTML(options.markdown, {
    notePath: options.notePath,
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
  const htmlBody = await markdownToHTML(note.content, { enableCopyButton: false });
  return generateWechatHTMLDocument(note.title, htmlBody, themeId, layout);
}
