import { markdownToHTML } from "@/lib/markdown-processor";
import { generateHTMLDocument } from "@/lib/markdown-to-html";
import { splitMarkdownByHr } from "@/lib/markdown-splitter";
import type { Note } from "@/types";
import type { ExportLayoutConfig } from "@shared";

export type ExportFormat = "html" | "pdf" | "image";

export async function buildExportDocument(
  note: Note,
  format: ExportFormat,
  themeId: string,
  layout?: Partial<ExportLayoutConfig>
): Promise<string> {
  const htmlBody = await markdownToHTML(note.content);
  return generateHTMLDocument(note.title, htmlBody, {
    themeId,
    format,
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
      const htmlBody = await markdownToHTML(section);
      return generateHTMLDocument(note.title, htmlBody, {
        themeId,
        format,
        layout
      });
    })
  );
}
