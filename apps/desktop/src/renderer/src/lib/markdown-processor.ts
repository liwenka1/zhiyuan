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
import rehypePrettyCode from "rehype-pretty-code";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import mermaid from "mermaid";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { iconButtonVariants } from "@/components/ui/button";
import { stripHiddenFrontmatter } from "./frontmatter";
import { markdownSanitizeSchema } from "./markdown-sanitize-config";
import { normalizeMarkdownPaths, resolveResourcePath, isRelativePath } from "@shared";

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

function rehypeCodeBlockCopyButton() {
  const copyButtonClasses = iconButtonVariants({
    size: "icon-compact",
    className:
      "absolute top-2 right-2 opacity-0 -translate-y-0.5 transition-opacity transition-transform group-hover:opacity-100 group-hover:translate-y-0"
  });

  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (node.tagName !== "pre") return;

      const preNode = node as Element;
      const preClassName = preNode.properties?.className;
      const nextPreClassName = mergeClassName(preClassName, ["relative", "group"]);
      if (preNode.properties) {
        preNode.properties.className = nextPreClassName;
      } else {
        preNode.properties = { className: nextPreClassName };
      }
      const hasCode = preNode.children.some(
        (child) => child.type === "element" && (child as Element).tagName === "code"
      );

      if (!hasCode) return;

      const hasButton = preNode.children.some(
        (child) =>
          child.type === "element" &&
          (child as Element).tagName === "button" &&
          (child as Element).properties?.["data-code-copy-button"] === "true"
      );
      if (hasButton) return;

      const buttonNode: Element = {
        type: "element",
        tagName: "button",
        properties: {
          type: "button",
          className: copyButtonClasses.split(" "),
          "data-code-copy-button": "true",
          "aria-label": "Copy code"
        },
        children: [
          {
            type: "element",
            tagName: "svg",
            properties: {
              // Lucide official Copy icon
              xmlns: "http://www.w3.org/2000/svg",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "aria-hidden": "true"
            },
            children: [
              {
                type: "element",
                tagName: "rect",
                properties: { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" },
                children: []
              },
              {
                type: "element",
                tagName: "path",
                properties: { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" },
                children: []
              }
            ]
          }
        ]
      };

      preNode.children.push(buttonNode);
    });
  };
}

function mergeClassName(className: unknown, next: string[]): string[] {
  if (Array.isArray(className)) {
    return Array.from(new Set([...className, ...next]));
  }
  if (typeof className === "string") {
    return Array.from(new Set([...className.split(" "), ...next]));
  }
  return [...next];
}

async function renderMermaidBlocks(html: string, isDarkTheme = false): Promise<string> {
  // 匹配 mermaid 代码块: <pre><code class="...language-mermaid...">...</code></pre>
  const mermaidRegex =
    /<pre[^>]*><code[^>]*(?:class="[^"]*language-mermaid[^"]*"|data-language="mermaid")[^>]*>([\s\S]*?)<\/code><\/pre>/g;
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

  // 处理 video/audio/source 标签的 src 属性
  result = result.replace(
    /<(video|audio|source)([^>]*?)src="([^"]+)"([^>]*?)>/g,
    (match, tagName, before, src, after) => {
      const decodedSrc = decodeURI(src);
      if (isRelativePath(decodedSrc)) {
        const resolvedSrc = resolveResourcePath(decodedSrc, notePath);
        return `<${tagName}${before}src="${resolvedSrc}"${after}>`;
      }
      return match;
    }
  );

  return result;
}

export interface MarkdownToHTMLOptions {
  /** 笔记文件路径（可选），用于解析相对资源路径 */
  notePath?: string;
  /** 是否为深色主题（影响 Mermaid 图表配色） */
  isDarkTheme?: boolean;
  /** 是否为代码块注入复制按钮（仅预览） */
  enableCopyButton?: boolean;
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
  const { notePath, isDarkTheme, enableCopyButton = true } = opts;
  // 预处理：移除隐藏的 frontmatter + 规范化本地路径
  // normalizeMarkdownPaths 会将本地绝对路径（/Users/...）转换为 local-resource:// 协议
  // 这样导出和预览的行为才能保持一致
  const normalized = normalizeMarkdownPaths(stripHiddenFrontmatter(markdown));
  const buildProcessor = (usePrettyCode: boolean) => {
    const processor = unified()
      .use(remarkParse) // 解析 Markdown
      .use(remarkGfm) // 支持 GitHub Flavored Markdown
      .use(remarkBreaks) // 支持换行
      .use(remarkMath) // 支持数学公式语法
      .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
      .use(rehypeRaw) // 支持原始 HTML
      .use(rehypeSanitize, markdownSanitizeSchema) // 安全过滤：移除恶意脚本，保留安全的 HTML
      .use(rehypeSlug); // 为标题添加 id

    if (usePrettyCode) {
      processor.use(rehypePrettyCode, {
        theme: isDarkTheme ? "github-dark" : "github-light",
        keepBackground: false
      });
    }

    if (enableCopyButton) {
      processor.use(rehypeCodeBlockCopyButton);
    }

    processor.use(rehypeKatex).use(rehypeStringify);
    return processor;
  };

  const file = await buildProcessor(true).process(normalized);

  // 处理 Mermaid 图表
  let html = await renderMermaidBlocks(String(file), isDarkTheme);

  // 如果提供了 notePath，处理 HTML 中的相对路径
  if (notePath) {
    html = resolveRelativePathsInHTML(html, notePath);
  }

  return html;
}
