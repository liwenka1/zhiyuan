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
import { normalizeMarkdownPaths, resolveResourcePath, isRelativePath } from "@/lib/resource-resolver";

// 初始化 mermaid（securityLevel: "strict" 防止 XSS）
mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });

/**
 * 从 HTML 中提取纯文本（移除所有标签）
 */
function extractTextFromHTML(html: string): string {
  return html
    .replace(/<[^>]+>/g, "") // 移除所有 HTML 标签
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function renderMermaidBlocks(html: string, isDarkTheme = false): Promise<string> {
  // 匹配 mermaid 代码块: <pre><code class="...language-mermaid...">...</code></pre>
  // 注意：rehypeHighlight 会添加 hljs class 和高亮标签，所以需要用更灵活的正则
  const mermaidRegex = /<pre><code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/g;
  const matches = [...html.matchAll(mermaidRegex)];

  if (matches.length === 0) return html;

  // 根据主题设置 mermaid 主题
  const mermaidTheme = isDarkTheme ? "dark" : "default";

  let result = html;
  for (const match of matches) {
    // 提取纯文本代码（移除高亮插件添加的 span 标签）
    const code = extractTextFromHTML(match[1]).trim();
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;

    // 为每个图表重新初始化 mermaid 主题（因为 theme 是全局配置）
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: "strict"
    });

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

export interface MarkdownToHTMLOptions {
  /** 笔记文件路径（可选），用于解析相对资源路径 */
  notePath?: string;
  /** 是否为深色主题（影响 Mermaid 图表配色） */
  isDarkTheme?: boolean;
}

/**
 * 将 Markdown 转换为 HTML
 * @param markdown Markdown 内容
 * @param options 转换选项
 * @returns HTML 字符串
 */
export async function markdownToHTML(markdown: string, options?: MarkdownToHTMLOptions | string): Promise<string> {
  // 兼容旧版 API：第二个参数可以是字符串（notePath）或对象
  const opts: MarkdownToHTMLOptions = typeof options === "string" ? { notePath: options } : (options ?? {});
  const { notePath, isDarkTheme } = opts;
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
  let html = await renderMermaidBlocks(String(file), isDarkTheme);

  // 如果提供了 notePath，处理 HTML 中的相对路径
  if (notePath) {
    html = resolveRelativePathsInHTML(html, notePath);
  }

  return html;
}
