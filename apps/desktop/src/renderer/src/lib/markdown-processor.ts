/**
 * Markdown 处理器
 * 在渲染进程中直接使用 unified 处理 Markdown
 */

import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import type { Root, Element } from "hast";
import type { Root as MarkdownRoot } from "mdast";
import { visit } from "unist-util-visit";
import { iconButtonVariants } from "@/components/ui/button";
import { markdownSanitizeSchema } from "./markdown-sanitize-config";
import { createUrlTransformer } from "@shared";
import { authorizeLocalResourcesInHtml } from "./local-resource";
import { markdownParser, normalizeMarkdownPaths } from "./markdown-links";

type MermaidApi = typeof import("mermaid").default;
let mermaidPromise: Promise<MermaidApi> | null = null;

async function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
    return mermaid;
  });
  return mermaidPromise;
}

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
      if (isMermaidCodeBlock(preNode)) return;

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

function isMermaidCodeBlock(preNode: Element): boolean {
  const codeNode = preNode.children.find(
    (child) => child.type === "element" && (child as Element).tagName === "code"
  ) as Element | undefined;
  if (!codeNode) return false;

  const className = codeNode.properties?.className;
  const dataLanguage = codeNode.properties?.["data-language"];
  const classTokens = Array.isArray(className)
    ? className.map((token) => String(token))
    : typeof className === "string"
      ? className.split(/\s+/)
      : [];

  return classTokens.includes("language-mermaid") || dataLanguage === "mermaid";
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
  // 匹配 mermaid 代码块，允许 pre 内存在额外节点（例如复制按钮）
  const mermaidRegex =
    /<pre[^>]*>\s*<code[^>]*(?:class="[^"]*language-mermaid[^"]*"|data-language="mermaid")[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/pre>/g;
  const matches = [...html.matchAll(mermaidRegex)];

  if (matches.length === 0) return html;

  const mermaid = await loadMermaid();

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

function remarkResolveResourcePaths(notePath?: string, workspacePath?: string | null) {
  const resolve = createUrlTransformer(notePath, { syntax: "markdown", workspacePath });
  return (tree: MarkdownRoot) => {
    visit(tree, ["link", "image", "definition"] as const, (node) => {
      // Resolve before remark-rehype begins percent-encoding Markdown destinations.
      node.url = resolve(node.url);
    });
  };
}

function rehypeResolveResourcePaths(notePath?: string, workspacePath?: string | null) {
  const resolve = createUrlTransformer(notePath, { syntax: "html", workspacePath });
  return (tree: Root) => {
    visit(tree, "element", (node) => {
      const attributes = node.tagName === "a" ? ["href"] : node.tagName === "video" ? ["src", "poster"] : ["src"];
      if (!["a", "img", "audio", "video", "source"].includes(node.tagName)) return;
      for (const attribute of attributes) {
        const source = node.properties[attribute];
        if (typeof source !== "string" || !source) continue;
        node.properties[attribute] = resolve(source);
      }
    });
  };
}

export interface MarkdownToHTMLOptions {
  /** 笔记文件路径（可选），用于解析相对资源路径 */
  notePath?: string;
  /** 当前工作区，用于识别从 UNC 工作区复制的绝对路径 */
  workspacePath?: string | null;
  /** 是否为深色主题（影响 Mermaid 图表配色） */
  isDarkTheme?: boolean;
  /** 是否为代码块注入复制按钮（仅预览） */
  enableCopyButton?: boolean;
  allowExternalMedia?: boolean;
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
  const { notePath, workspacePath, isDarkTheme, enableCopyButton = true, allowExternalMedia = false } = opts;
  // 预处理：规范化本地路径
  // normalizeMarkdownPaths 会将本地绝对路径（/Users/...）转换为 local-resource:// 协议
  // 这样导出和预览的行为才能保持一致
  const normalized = normalizeMarkdownPaths(markdown, workspacePath);
  const buildProcessor = (usePrettyCode: boolean) => {
    const processor = markdownParser()
      .use(remarkBreaks) // 支持换行
      .use(remarkResolveResourcePaths, notePath, workspacePath)
      .use(remarkRehype, { allowDangerousHtml: true }) // 转换为 HTML AST
      .use(rehypeRaw) // 支持原始 HTML
      .use(rehypeResolveResourcePaths, notePath, workspacePath)
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
  const html = await renderMermaidBlocks(String(file), isDarkTheme);
  const resourceToken = typeof window === "undefined" ? "" : (window.api?.utils?.getLocalResourceToken?.() ?? "");
  return authorizeLocalResourcesInHtml(html, resourceToken, allowExternalMedia);
}
