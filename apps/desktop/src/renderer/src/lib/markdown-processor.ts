/**
 * Markdown 处理器
 * 在渲染进程中直接使用 unified 处理 Markdown
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";

/**
 * 将 Markdown 转换为 HTML
 * @param markdown Markdown 内容
 * @returns HTML 字符串
 */
export async function markdownToHTML(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse) // 解析 Markdown
    .use(remarkGfm) // 支持 GitHub Flavored Markdown
    .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
    .use(rehypeRaw) // 支持原始 HTML
    .use(rehypeSlug) // 为标题添加 id
    .use(rehypeStringify) // 转换为 HTML 字符串
    .process(markdown);

  return String(file);
}
