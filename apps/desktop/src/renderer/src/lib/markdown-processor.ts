/**
 * Markdown 处理器
 * 在渲染进程中直接使用 unified 处理 Markdown
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import mermaid from "mermaid";
import { stripHiddenFrontmatter } from "./frontmatter";
import { markdownSanitizeSchema } from "./markdown-sanitize-config";
import { normalizeMarkdownPaths, resolveResourcePath, isRelativePath } from "./resource-resolver";

// 初始化 mermaid（securityLevel: "strict" 防止 XSS）
mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });

/**
 * 将 Mermaid 代码块转换为 SVG
 */
async function renderMermaidBlocks(html: string): Promise<string> {
  // 匹配 mermaid 代码块: <pre><code class="language-mermaid">...</code></pre>
  const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
  const matches = [...html.matchAll(mermaidRegex)];

  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const code = match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    const svg = await mermaid.render(id, code).then(
      ({ svg }) => svg,
      () => null
    );
    if (svg) {
      result = result.replace(match[0], `<div class="mermaid">${svg}</div>`);
    }
  }
  return result;
}

/**
 * 解析 HTML 中的相对路径（img src, a href 等）
 * 将相对路径转换为 local-resource:// 协议的绝对路径
 */
function resolveRelativePathsInHTML(html: string, notePath: string): string {
  // 处理 img 标签的 src 属性
  let result = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, before, src, after) => {
    const decodedSrc = decodeURI(src);
    if (isRelativePath(decodedSrc)) {
      const resolvedSrc = resolveResourcePath(decodedSrc, notePath);
      return `<img${before}src="${resolvedSrc}"${after}>`;
    }
    return match;
  });

  // 处理 a 标签的 href 属性（文件链接）
  result = result.replace(/<a([^>]*?)href="([^"]+)"([^>]*?)>/g, (match, before, href, after) => {
    const decodedHref = decodeURI(href);
    if (isRelativePath(decodedHref)) {
      const resolvedHref = resolveResourcePath(decodedHref, notePath);
      return `<a${before}href="${resolvedHref}"${after}>`;
    }
    return match;
  });

  return result;
}

/**
 * 将 Markdown 转换为 HTML
 * @param markdown Markdown 内容
 * @param notePath 笔记文件路径（可选），用于解析相对资源路径
 * @returns HTML 字符串
 */
export async function markdownToHTML(markdown: string, notePath?: string): Promise<string> {
  // 预处理：移除隐藏的 frontmatter + 规范化本地路径
  // normalizeMarkdownPaths 会将本地绝对路径（/Users/...）转换为 local-resource:// 协议
  // 这样导出和预览的行为才能保持一致
  const normalized = normalizeMarkdownPaths(stripHiddenFrontmatter(markdown));
  const file = await unified()
    .use(remarkParse) // 解析 Markdown
    .use(remarkGfm) // 支持 GitHub Flavored Markdown
    .use(remarkBreaks) // 支持换行
    .use(remarkMath) // 支持数学公式语法
    .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
    .use(rehypeRaw) // 支持原始 HTML
    .use(rehypeSanitize, markdownSanitizeSchema) // 安全过滤：移除恶意脚本，保留安全的 HTML
    .use(rehypeSlug) // 为标题添加 id
    .use(rehypeHighlight, { detect: true }) // 代码语法高亮
    .use(rehypeKatex) // 渲染数学公式
    .use(rehypeStringify) // 转换为 HTML 字符串
    .process(normalized);

  // 处理 Mermaid 图表
  let html = await renderMermaidBlocks(String(file));

  // 如果提供了 notePath，处理 HTML 中的相对路径
  if (notePath) {
    html = resolveRelativePathsInHTML(html, notePath);
  }

  return html;
}
