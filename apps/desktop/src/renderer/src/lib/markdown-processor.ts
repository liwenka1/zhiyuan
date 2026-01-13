/**
 * Markdown 处理器
 * 在渲染进程中直接使用 unified 处理 Markdown
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import mermaid from "mermaid";

// 初始化 mermaid
mermaid.initialize({ startOnLoad: false, theme: "default" });

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
    try {
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, code);
      result = result.replace(match[0], `<div class="mermaid">${svg}</div>`);
    } catch {
      // 渲染失败时保留原代码块
    }
  }
  return result;
}

/**
 * 将 Markdown 转换为 HTML
 * @param markdown Markdown 内容
 * @returns HTML 字符串
 */
export async function markdownToHTML(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse) // 解析 Markdown
    .use(remarkGfm) // 支持 GitHub Flavored Markdown
    .use(remarkMath) // 支持数学公式语法
    .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
    .use(rehypeRaw) // 支持原始 HTML
    .use(rehypeSlug) // 为标题添加 id
    .use(rehypeHighlight, { detect: true }) // 代码语法高亮
    .use(rehypeKatex) // 渲染数学公式
    .use(rehypeStringify) // 转换为 HTML 字符串
    .process(markdown);

  // 处理 Mermaid 图表
  const html = await renderMermaidBlocks(String(file));

  return html;
}
